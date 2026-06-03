import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, loadRemoteState, saveRemoteState } from "./lib/supabase";

const STORAGE_KEY = "remitos-facturas-state-v1";
const FINANCE_SUMMARY_URL =
  import.meta.env.VITE_FINANCE_SUMMARY_URL || "https://fleet-finanzas.vercel.app/api/cheques-cartera";
const ARS_PER_USD = 1100;
const IVA_RATE = 0.21;
const IVA_TOTAL_RATE = 1 + IVA_RATE;
const FISCAL_CREDIT_PERCENTAGES = [
  { value: "100", label: "Tomar 100%" },
  { value: "40", label: "Tomar 40%" },
];
const TRIP_RATE_ORIGINS = [
  { key: "mendoza", label: "Desde Mza" },
  { key: "sanJuan", label: "Desde San Juan" },
];
const POSITION_RANGES = [
  { key: "positions1To6", label: "1 a 6 posiciones" },
  { key: "positions7To11", label: "7 a 11 posiciones" },
  { key: "positions12To15", label: "12 a 15 posiciones" },
];

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const currentDate = today.toISOString().slice(0, 10);

const initialState = {
  profile: {
    appName: "Facturas",
  },
  clients: [
    { id: "ypf", name: "YPF", isMisc: false },
    { id: "maxiconsumo", name: "Maxiconsumo", isMisc: false },
    { id: "tolsa", name: "Tolsa", isMisc: false },
    { id: "varios", name: "Varios", isMisc: true },
  ],
  invoices: [
    {
      id: "inv-1",
      clientId: "ypf",
      invoiceNumber: "0004-00001234",
      date: currentDate,
      amount: 485000,
      paid: false,
      customerName: "",
    },
    {
      id: "inv-2",
      clientId: "maxiconsumo",
      invoiceNumber: "0004-00001235",
      date: currentDate,
      amount: 329000,
      paid: true,
      customerName: "",
    },
    {
      id: "inv-3",
      clientId: "varios",
      invoiceNumber: "0004-00001236",
      date: currentDate,
      amount: 192500,
      paid: false,
      customerName: "Transporte Sur",
    },
  ],
  unbilledTrips: [
    {
      id: "trip-1",
      clientId: "ypf",
      customerName: "",
      date: currentDate,
      route: "Neuquen -> Plaza Huincul",
      amount: 178000,
      note: "Pendiente de emitir factura",
      billed: false,
    },
    {
      id: "trip-2",
      clientId: "varios",
      customerName: "Distribuidora Delta",
      date: currentDate,
      route: "Mendoza -> San Rafael",
      amount: 94500,
      note: "Viaje cerrado, falta cargar comprobante",
      billed: false,
    },
  ],
  fiscalCredits: [],
};

const blankInvoice = {
  invoiceNumber: "",
  date: currentDate,
  amount: "",
  paid: false,
  customerName: "",
  cargoNumber: "",
};

const blankTrip = {
  clientId: "ypf",
  customerName: "",
  date: currentDate,
  route: "",
  amount: "",
  note: "",
};

const blankFiscalCredit = {
  amount: "",
  percentage: "100",
};

function App() {
  const [appState, setAppState] = useDatabaseState(initialState);
  const [activeView, setActiveView] = useState("dashboard");
  const [financeSummary, setFinanceSummary] = useState({
    amount: null,
    count: null,
  });
  const selectedMonth = currentMonth;

  const clients = appState.clients || [];
  const invoices = appState.invoices || [];
  const unbilledTrips = appState.unbilledTrips || [];
  const fiscalCredits = appState.fiscalCredits || [];

  const clientsById = useMemo(
    () =>
      Object.fromEntries(
        clients.map((client) => [client.id, client]),
      ),
    [clients],
  );

  const dashboardSummary = useMemo(
    () =>
      clients.map((client) => {
        const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
        const monthlyInvoices = clientInvoices.filter((invoice) => invoice.date?.startsWith(selectedMonth));
        const unpaidInvoices = clientInvoices.filter((invoice) => !invoice.paid);
        const overdueInvoices = unpaidInvoices.filter(isOverdueInvoice);

        return {
          ...client,
          totalDue: sumAmounts(unpaidInvoices),
          monthTotal: sumAmounts(monthlyInvoices),
          monthVat: calculateIncludedVat(sumAmounts(monthlyInvoices)),
          pendingCount: overdueInvoices.length,
          totalInvoices: clientInvoices.length,
        };
      }),
    [clients, invoices, selectedMonth],
  );

  const totalUnpaid = useMemo(
    () => dashboardSummary.reduce((sum, client) => sum + client.totalDue, 0),
    [dashboardSummary],
  );

  const totalMonthlyBilled = useMemo(
    () => dashboardSummary.reduce((sum, client) => sum + client.monthTotal, 0),
    [dashboardSummary],
  );

  const unbilledPendingTrips = useMemo(
    () => unbilledTrips.filter((trip) => !trip.billed),
    [unbilledTrips],
  );

  const unbilledTripsAmount = useMemo(
    () => sumTripBillableAmounts(unbilledPendingTrips, clientsById),
    [clientsById, unbilledPendingTrips],
  );

  const totalMonthlyVat = useMemo(
    () => dashboardSummary.reduce((sum, client) => sum + client.monthVat, 0),
    [dashboardSummary],
  );

  const donutItems = useMemo(
    () =>
      dashboardSummary
        .filter((client) => client.totalDue > 0)
        .map((client) => ({
          label: client.name,
          value: client.totalDue,
          detail: client.pendingCount ? `${client.pendingCount} vencidas` : "En termino",
        })),
    [dashboardSummary],
  );

  const addClient = (name) => {
    const trimmedName = name.trim();
    const repeatedClient = clients.some((client) => client.name.toLowerCase() === trimmedName.toLowerCase());
    if (!trimmedName || repeatedClient) return null;

    const clientId = buildClientId(trimmedName, clients);

    setAppState((current) => ({
      ...current,
      clients: [
        ...current.clients,
        {
          id: clientId,
          name: trimmedName,
          isMisc: isMiscClient({ name: trimmedName }),
          tripRates: buildEmptyTripRates(),
        },
      ],
    }));

    return clientId;
  };

  const updateClient = (clientId, values) => {
    const trimmedName = values.name.trim();
    const repeatedClient = clients.some(
      (client) => client.id !== clientId && client.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (!trimmedName || repeatedClient) return false;

    setAppState((current) => ({
      ...current,
      clients: current.clients.map((client) =>
        client.id === clientId
          ? {
              ...client,
              name: trimmedName,
              isMisc: isMiscClient({ name: trimmedName }),
              tripRates: normalizeTripRates(values.tripRates),
            }
          : client,
      ),
    }));

    return true;
  };

  const addInvoice = (clientId, values) => {
    const normalized = normalizeInvoice(values);
    if (!normalized.invoiceNumber || !normalized.amount) return false;

    setAppState((current) => ({
      ...current,
      invoices: [{ id: createRecordId("invoice"), clientId, ...normalized }, ...current.invoices],
    }));

    return true;
  };

  const toggleInvoicePaid = (invoiceId) => {
    setAppState((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, paid: !invoice.paid } : invoice,
      ),
    }));
  };

  const deleteInvoice = (invoiceId) => {
    setAppState((current) => ({
      ...current,
      invoices: current.invoices.filter((invoice) => invoice.id !== invoiceId),
    }));
  };

  const addTrip = (values) => {
    const normalized = normalizeTrip(values);
    if (!normalized.route || !normalized.amount) return false;

    setAppState((current) => ({
      ...current,
      unbilledTrips: [{ id: createRecordId("trip"), billed: false, ...normalized }, ...current.unbilledTrips],
    }));

    return true;
  };

  const toggleTripBilled = (tripId) => {
    setAppState((current) => ({
      ...current,
      unbilledTrips: current.unbilledTrips.map((trip) =>
        trip.id === tripId ? { ...trip, billed: !trip.billed } : trip,
      ),
    }));
  };

  const deleteTrip = (tripId) => {
    setAppState((current) => ({
      ...current,
      unbilledTrips: current.unbilledTrips.filter((trip) => trip.id !== tripId),
    }));
  };

  const addFiscalCredit = (month, values) => {
    const amount = Number(values.amount || 0);
    const percentage = normalizeFiscalCreditPercentage(values.percentage);
    if (!month || !amount) return false;

    setAppState((current) => ({
      ...current,
      fiscalCredits: [{ id: createRecordId("fiscal-credit"), month, amount, percentage }, ...(current.fiscalCredits || [])],
    }));

    return true;
  };

  const deleteFiscalCredit = (creditId) => {
    setAppState((current) => ({
      ...current,
      fiscalCredits: (current.fiscalCredits || []).filter((credit) => credit.id !== creditId),
    }));
  };

  useEffect(() => {
    if (activeView !== "dashboard") return undefined;
    let isMounted = true;

    const loadFinanceSummary = async () => {
      try {
        const response = await fetch(FINANCE_SUMMARY_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`Finance API ${response.status}`);
        const payload = await response.json();
        if (!isMounted) return;

        setFinanceSummary({
          amount: Number.isFinite(Number(payload.amount)) ? Number(payload.amount) : null,
          count: Number.isFinite(Number(payload.count)) ? Number(payload.count) : null,
        });
      } catch (error) {
        console.error("finance API error", error);
      }
    };

    loadFinanceSummary();
    const timer = window.setInterval(loadFinanceSummary, 2500);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [activeView]);

  return (
    <div className="app-shell">
      <div className="page-gradient" />

      <header className="topbar">
        <h1>{appState.profile.appName}</h1>

        <div className="segmented" aria-label="Navegacion principal">
          <button
            className={activeView === "dashboard" ? "is-active" : ""}
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={activeView === "clientes" ? "is-active" : ""}
            onClick={() => setActiveView("clientes")}
          >
            Clientes
          </button>
          <button
            className={activeView === "viajes" ? "is-active" : ""}
            onClick={() => setActiveView("viajes")}
          >
            Viajes
          </button>
          <button
            className={activeView === "iva" ? "is-active" : ""}
            onClick={() => setActiveView("iva")}
          >
            IVA
          </button>
        </div>
      </header>

      {activeView === "dashboard" ? (
        <DashboardView
          selectedMonth={selectedMonth}
          totalUnpaid={totalUnpaid}
          totalMonthlyBilled={totalMonthlyBilled}
          totalMonthlyVat={totalMonthlyVat}
          unbilledTripsAmount={unbilledTripsAmount}
          pendingTrips={unbilledPendingTrips}
          summary={dashboardSummary}
          donutItems={donutItems}
          financeSummary={financeSummary}
        />
      ) : activeView === "clientes" ? (
        <ClientsView
          clients={clients}
          invoices={invoices}
          selectedMonth={selectedMonth}
          onAddClient={addClient}
          onUpdateClient={updateClient}
          onAddInvoice={addInvoice}
          onToggleInvoicePaid={toggleInvoicePaid}
          onDeleteInvoice={deleteInvoice}
        />
      ) : activeView === "viajes" ? (
        <TripsView
          clients={clients}
          unbilledTrips={unbilledTrips}
          onAddTrip={addTrip}
          onToggleTripBilled={toggleTripBilled}
          onDeleteTrip={deleteTrip}
        />
      ) : (
        <IvaView
          invoices={invoices}
          fiscalCredits={fiscalCredits}
          onAddFiscalCredit={addFiscalCredit}
          onDeleteFiscalCredit={deleteFiscalCredit}
        />
      )}
    </div>
  );
}

function DashboardView({
  selectedMonth,
  totalUnpaid,
  totalMonthlyBilled,
  totalMonthlyVat,
  unbilledTripsAmount,
  pendingTrips,
  summary,
  donutItems,
  financeSummary,
}) {
  const pendingClients = summary.filter((client) => client.totalDue > 0);
  const unbilledClients = summary
    .map((client) => {
      const clientTrips = pendingTrips.filter((trip) => trip.clientId === client.id);
      const totalUnbilled = sumTripBillableAmounts(clientTrips, { [client.id]: client });

      return {
        ...client,
        totalUnbilled,
      };
    })
    .filter((client) => client.totalUnbilled > 0);

  return (
    <main className="layout-stack">
      <section className="metrics-grid">
        <MetricCard label="Total sin cobrar" value={formatCurrency(totalUnpaid)} detail="Saldo pendiente general" tone="green" />
        <MetricCard
          label="Facturado del mes"
          value={formatCurrency(totalMonthlyBilled)}
          detail={`Periodo ${formatMonth(selectedMonth)}`}
          tone="gold"
        />
        <MetricCard
          label="IVA estimado"
          value={formatCurrency(totalMonthlyVat)}
          detail={`${formatPercent(IVA_RATE)} incluido en lo facturado`}
          tone="sand"
        />
        <MetricCard
          label="Monto no facturado"
          value={formatCurrency(unbilledTripsAmount)}
          detail="Con IVA salvo Varios"
          tone="orange"
        />
        <MetricCard
          label="Cheques en cartera"
          value={financeSummary?.amount == null ? "Sin datos" : formatCurrency(financeSummary.amount)}
          detail={financeSummary?.count != null ? `${financeSummary.count} cheques` : "Sincronizando con FinanzasApp"}
          tone="slate"
        />
      </section>

      <section className="dashboard-receivables">
        <article className="panel receivables-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Resumen principal</p>
              <h2>Facturado pendiente de cobro</h2>
            </div>
          </div>

          <div className="receivables-body">
            <div className="receivables-donut">
              <DonutChart
                items={donutItems}
                centerLabel="Total sin cobrar"
                centerValue={formatUsdFromArs(totalUnpaid)}
                centerDetail={`Dolar ${formatCurrency(ARS_PER_USD)}`}
              />
              <div className="receivables-kpis">
                <StatBox label="Pendiente de cobro" value={formatCurrency(totalUnpaid)} />
                <StatBox label="No facturado" value={formatCurrency(unbilledTripsAmount)} />
                <StatBox label="Clientes con deuda" value={String(pendingClients.length)} />
                <StatBox label="Viajes pendientes" value={String(pendingTrips.length)} />
              </div>
            </div>

            <div className="client-breakdown">
              <section className="breakdown-section">
                <div className="breakdown-title">
                  <h3>Cliente por cliente</h3>
                  <p>Saldo pendiente convertido a USD.</p>
                </div>

                {pendingClients.length ? (
                  <div className="breakdown-table">
                    <div className="breakdown-head">
                      <span>Cliente</span>
                      <span>Adeudado</span>
                    </div>

                    {pendingClients.map((client, index) => (
                      <div className="breakdown-row" key={client.id}>
                        <div className="breakdown-client">
                          <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} />
                          <strong>{client.name}</strong>
                        </div>
                        <strong>{formatCurrency(client.totalDue)}</strong>
                      </div>
                    ))}

                    <div className="breakdown-row breakdown-total">
                      <strong>Total</strong>
                      <strong>{formatCurrency(totalUnpaid)}</strong>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Sin deuda pendiente"
                    message="Todas las facturas cargadas figuran como cobradas."
                  />
                )}
              </section>

              <section className="breakdown-section">
                <div className="breakdown-title">
                  <h3>No facturados</h3>
                  <p>Viajes pendientes con IVA salvo Varios.</p>
                </div>

                {unbilledClients.length ? (
                  <div className="breakdown-table">
                    <div className="breakdown-head">
                      <span>Cliente</span>
                      <span>A facturar</span>
                    </div>

                    {unbilledClients.map((client, index) => (
                      <div className="breakdown-row" key={client.id}>
                        <div className="breakdown-client">
                          <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} />
                          <strong>{client.name}</strong>
                        </div>
                        <strong>{formatCurrency(client.totalUnbilled)}</strong>
                      </div>
                    ))}

                    <div className="breakdown-row breakdown-total">
                      <strong>Total</strong>
                      <strong>{formatCurrency(unbilledTripsAmount)}</strong>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Sin viajes no facturados"
                    message="Cuando haya viajes pendientes, van a aparecer aca."
                  />
                )}
              </section>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function ClientsView({
  clients,
  invoices,
  selectedMonth,
  onAddClient,
  onUpdateClient,
  onAddInvoice,
  onToggleInvoicePaid,
  onDeleteInvoice,
}) {
  const [showClientModal, setShowClientModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [expandedClientId, setExpandedClientId] = useState("");

  const createClient = (values) => {
    const clientId = onAddClient(values.name);
    if (!clientId) return false;

    setExpandedClientId(clientId);
    setShowClientModal(false);
    return true;
  };

  const updateClient = (values) => {
    if (!editingClient) return false;
    const wasUpdated = onUpdateClient(editingClient.id, values);
    if (!wasUpdated) return false;

    setEditingClient(null);
    return true;
  };

  const createInvoice = (clientId, values) => {
    const wasCreated = onAddInvoice(clientId, values);
    if (!wasCreated) return false;

    setExpandedClientId(clientId);
    setShowInvoiceModal(false);
    return true;
  };

  return (
    <main className="layout-stack">
      <section className="clients-actions">
        <div className="clients-action-stack">
          <button className="primary-button" type="button" onClick={() => setShowClientModal(true)}>
            Agregar cliente
          </button>

          <button className="primary-button" type="button" onClick={() => setShowInvoiceModal(true)}>
            Agregar factura
          </button>
        </div>
      </section>

      {showClientModal ? (
        <FormModal title="Agregar cliente" onClose={() => setShowClientModal(false)}>
          <ClientForm onSubmit={createClient} onCancel={() => setShowClientModal(false)} />
        </FormModal>
      ) : null}

      {showInvoiceModal ? (
        <FormModal title="Agregar factura" onClose={() => setShowInvoiceModal(false)}>
          <InvoiceForm clients={clients} onSubmit={createInvoice} />
        </FormModal>
      ) : null}

      {editingClient ? (
        <FormModal title="Editar cliente" onClose={() => setEditingClient(null)}>
          <ClientForm
            initialName={editingClient.name}
            initialTripRates={editingClient.tripRates}
            showTripRates
            submitLabel="Guardar cambios"
            onSubmit={updateClient}
            onCancel={() => setEditingClient(null)}
          />
        </FormModal>
      ) : null}

      <section className="client-list">
        {clients.map((client) => {
          const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
          const monthlyTotal = sumAmounts(clientInvoices.filter((invoice) => invoice.date?.startsWith(selectedMonth)));
          const monthlyVat = calculateIncludedVat(monthlyTotal);
          const unpaidInvoices = clientInvoices.filter((invoice) => !invoice.paid);
          const overdueInvoices = unpaidInvoices.filter(isOverdueInvoice);
          const overdueTotal = sumAmounts(overdueInvoices);
          const overdueCount = overdueInvoices.length;
          const hasOpenInvoices = unpaidInvoices.length > 0;

          return (
            <details className="panel client-disclosure" key={client.id} open={expandedClientId === client.id}>
              <summary
                className="client-summary"
                onClick={(event) => {
                  event.preventDefault();
                  setExpandedClientId((current) => (current === client.id ? "" : client.id));
                }}
              >
                <div className="client-name">
                  <h2>{client.name}</h2>
                </div>
                <button
                  className="ghost-button compact-action"
                  type="button"
                  aria-label={`Editar ${client.name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditingClient(client);
                  }}
                >
                  <span aria-hidden="true" className="edit-icon">✎</span>
                  <span>Editar</span>
                </button>
                <SummaryMetric label="Total vencido" value={formatCurrency(overdueTotal)} />
                <span className={`status-pill ${overdueCount ? "warning" : hasOpenInvoices ? "soft" : "ok"}`}>
                  {overdueCount ? `${overdueCount} vencidas` : hasOpenInvoices ? "En termino" : "Al dia"}
                </span>
                <span className="disclosure-arrow" aria-hidden="true" />
              </summary>

              <div className="client-details">
                <div className="mini-stats">
                  <StatBox label="Total vencido" value={formatCurrency(overdueTotal)} />
                  <StatBox label="Facturado del mes" value={formatCurrency(monthlyTotal)} />
                  <StatBox label="IVA estimado" value={formatCurrency(monthlyVat)} />
                </div>

                <div className="invoice-list">
                  {clientInvoices.length ? (
                    clientInvoices.map((invoice) => (
                      <details className={`invoice-row ${invoice.paid ? "is-paid" : ""}`} key={invoice.id}>
                        <summary>
                          <span>
                            <small>Nro. factura</small>
                            <strong>{invoice.invoiceNumber}</strong>
                          </span>
                          <span>
                            <small>Fecha</small>
                            <strong>{formatDate(invoice.date)}</strong>
                          </span>
                          <span>
                            <small>Monto</small>
                            <strong>{formatCurrency(invoice.amount)}</strong>
                          </span>
                          <span className="disclosure-arrow small" aria-hidden="true" />
                        </summary>
                        <div className="invoice-row-details">
                          {(isMiscClient(client) && invoice.customerName) || invoice.cargoNumber ? (
                            <div className="invoice-detail-copy">
                              {isMiscClient(client) && invoice.customerName ? (
                                <p className="invoice-customer">{invoice.customerName}</p>
                              ) : null}
                              {invoice.cargoNumber ? (
                                <p className="invoice-customer">Carga {invoice.cargoNumber}</p>
                              ) : null}
                            </div>
                          ) : null}
                          <span className={`status-pill ${getInvoiceStatusTone(invoice)}`}>
                            {getInvoiceStatusLabel(invoice)}
                          </span>
                          <div className="row-actions">
                            <button className="ghost-button" type="button" onClick={() => onToggleInvoicePaid(invoice.id)}>
                              {invoice.paid ? "Marcar impaga" : "Marcar pagada"}
                            </button>
                            <button className="ghost-button danger" type="button" onClick={() => onDeleteInvoice(invoice.id)}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </details>
                    ))
                  ) : (
                    <EmptyState title="Sin facturas" message="Carga la primera factura de este cliente." />
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}

function TripsView({
  clients,
  unbilledTrips,
  onAddTrip,
  onToggleTripBilled,
  onDeleteTrip,
}) {
  const openTrips = unbilledTrips.filter((trip) => !trip.billed);
  const clientsWithOpenTrips = clients.filter((client) =>
    openTrips.some((trip) => trip.clientId === client.id),
  );
  const [showTripModal, setShowTripModal] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState("");

  const createTrip = (values) => {
    const wasCreated = onAddTrip(values);
    if (!wasCreated) return false;

    setShowTripModal(false);
    return true;
  };

  return (
    <main className="layout-stack">
      <section className="panel trips-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Seccion</p>
            <h2>Viajes no facturados</h2>
          </div>
          <span className="badge">{openTrips.length} abiertos</span>
        </div>
      </section>

      <section className="clients-actions">
        <div className="clients-action-stack single-action-stack">
          <button className="primary-button" type="button" onClick={() => setShowTripModal(true)}>
            Agregar viaje no facturado
          </button>
        </div>
      </section>

      {showTripModal ? (
        <FormModal title="Agregar viaje no facturado" onClose={() => setShowTripModal(false)}>
          <TripForm clients={clients} onSubmit={createTrip} />
        </FormModal>
      ) : null}

      <section className="client-list">
        {clientsWithOpenTrips.length ? clientsWithOpenTrips.map((client) => {
          const clientTrips = unbilledTrips.filter((trip) => trip.clientId === client.id);
          const unbilledClientTrips = clientTrips.filter((trip) => !trip.billed);
          const totalUnbilled = sumTripBillableAmounts(unbilledClientTrips, { [client.id]: client });
          const pending = unbilledClientTrips.length;

          return (
            <details className="panel client-disclosure" key={client.id} open={expandedClientId === client.id}>
              <summary
                className="client-summary"
                onClick={(event) => {
                  event.preventDefault();
                  setExpandedClientId((current) => (current === client.id ? "" : client.id));
                }}
              >
                <div className="client-name">
                  <h2>{client.name}</h2>
                </div>
                <SummaryMetric label="Total a facturar" value={formatCurrency(totalUnbilled)} />
                <span className={`status-pill ${pending ? "warning" : "ok"}`}>
                  {pending ? `${pending} viajes` : "Al dia"}
                </span>
                <span className="disclosure-arrow" aria-hidden="true" />
              </summary>

              <div className="client-details">
                <div className="mini-stats">
                  <StatBox label="Total a facturar" value={formatCurrency(totalUnbilled)} />
                  <StatBox label="Viajes pendientes" value={String(pending)} />
                </div>

                <div className="trip-list">
                  {clientTrips.length ? (
                    clientTrips.map((trip) => {
                      const tripBillableAmount = getTripBillableAmount(trip, client);

                      return (
                        <details className={`invoice-row ${trip.billed ? "is-paid" : ""}`} key={trip.id}>
                          <summary>
                            <span>
                              <small>Trayecto</small>
                              <strong>{trip.route}</strong>
                            </span>
                            <span>
                              <small>Fecha</small>
                              <strong>{formatDate(trip.date)}</strong>
                            </span>
                            <span>
                              <small>{isMiscClient(client) ? "Monto" : "Monto c/IVA"}</small>
                              <strong>{formatCurrency(tripBillableAmount)}</strong>
                            </span>
                            <span className="disclosure-arrow small" aria-hidden="true" />
                          </summary>
                          <div className="invoice-row-details">
                            <div className="trip-detail-copy">
                              {isMiscClient(client) && trip.customerName ? <p className="invoice-customer">{trip.customerName}</p> : null}
                              {trip.note ? <p className="trip-note">{trip.note}</p> : null}
                            </div>
                            <span className={`status-pill ${trip.billed ? "ok" : "warning"}`}>
                              {trip.billed ? "Facturado" : "No facturado"}
                            </span>
                            <div className="row-actions">
                              <button className="ghost-button" type="button" onClick={() => onToggleTripBilled(trip.id)}>
                                {trip.billed ? "Reabrir" : "Marcar facturado"}
                              </button>
                              <button className="ghost-button danger" type="button" onClick={() => onDeleteTrip(trip.id)}>
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </details>
                      );
                    })
                  ) : (
                    <EmptyState title="Sin viajes" message="Carga el primer viaje pendiente de este cliente." />
                  )}
                </div>
              </div>
            </details>
          );
        }) : (
          <section className="panel trips-panel">
            <EmptyState title="Sin viajes no facturados" message="Cuando un cliente tenga viajes pendientes, va a aparecer aca." />
          </section>
        )}
      </section>
    </main>
  );
}

function IvaView({
  invoices,
  fiscalCredits,
  onAddFiscalCredit,
  onDeleteFiscalCredit,
}) {
  const [selectedTaxMonth, setSelectedTaxMonth] = useState(currentMonth);

  const monthlyInvoices = invoices.filter((invoice) => invoice.date?.startsWith(selectedTaxMonth));
  const monthlyBilledTotal = sumAmounts(monthlyInvoices);
  const fiscalDebit = calculateIncludedVat(monthlyBilledTotal);
  const monthCredits = fiscalCredits.filter((credit) => credit.month === selectedTaxMonth);
  const fiscalCredit = monthCredits.reduce((sum, credit) => sum + getFiscalCreditAppliedAmount(credit), 0);
  const vatToPay = fiscalDebit - fiscalCredit;

  const addCredit = (values) => onAddFiscalCredit(selectedTaxMonth, values);

  return (
    <main className="layout-stack">
      <section className="panel iva-panel">
        <div className="panel-header iva-header">
          <div>
            <p className="eyebrow">Liquidacion mensual</p>
            <h2>IVA</h2>
          </div>
          <label className="month-control">
            Mes
            <input
              type="month"
              value={selectedTaxMonth}
              onChange={(event) => setSelectedTaxMonth(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Debito fiscal" value={formatCurrency(fiscalDebit)} detail="IVA incluido en ventas" tone="green" />
        <MetricCard label="Credito fiscal" value={formatCurrency(fiscalCredit)} detail="Facturas cargadas" tone="gold" />
        <MetricCard label="IVA a pagar" value={formatCurrency(vatToPay)} detail={`Periodo ${formatMonth(selectedTaxMonth)}`} tone="orange" />
        <MetricCard label="Facturado del mes" value={formatCurrency(monthlyBilledTotal)} detail={`${monthlyInvoices.length} facturas`} tone="sand" />
      </section>

      <section className="panel iva-credit-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Credito fiscal</p>
            <h2>Cargar factura</h2>
          </div>
          <span className="badge">{monthCredits.length} cargadas</span>
        </div>

        <FiscalCreditForm onSubmit={addCredit} />

        <div className="credit-list">
          {monthCredits.length ? (
            monthCredits.map((credit) => {
              const percentage = getFiscalCreditPercentage(credit);
              const appliedAmount = getFiscalCreditAppliedAmount(credit);

              return (
                <div className="credit-row" key={credit.id}>
                  <div className="credit-row-main">
                    <strong>Credito fiscal</strong>
                    <small>
                      {percentage}% tomado
                      {percentage !== 100 ? ` de ${formatCurrency(credit.amount)}` : ""}
                    </small>
                  </div>
                  <span>{formatCurrency(appliedAmount)}</span>
                <button className="ghost-button danger compact-action" type="button" onClick={() => onDeleteFiscalCredit(credit.id)}>
                  Eliminar
                </button>
              </div>
              );
            })
          ) : (
            <EmptyState title="Sin credito fiscal" message="Carga importes para restarlos del debito fiscal del mes." />
          )}
        </div>
      </section>
    </main>
  );
}

function ClientForm({
  initialName = "",
  initialTripRates,
  showTripRates = false,
  submitLabel = "Crear cliente",
  onSubmit,
  onCancel,
}) {
  const [name, setName] = useState(initialName);
  const [tripRates, setTripRates] = useState(() => hydrateTripRates(initialTripRates));
  const [error, setError] = useState("");

  const updateTripRate = (originKey, rangeKey, value) => {
    setTripRates((current) => ({
      ...current,
      [originKey]: {
        ...current[originKey],
        [rangeKey]: value,
      },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!onSubmit({ name, tripRates })) {
      setError("Escribi un nombre valido y que no este repetido.");
      return;
    }

    setName("");
    setTripRates(buildEmptyTripRates());
    setError("");
  };

  return (
    <form className={`client-create-form ${showTripRates ? "with-trip-rates" : ""}`} onSubmit={handleSubmit}>
      <label htmlFor="new-client">
        Nombre del cliente
        <input
          id="new-client"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="Nombre del cliente"
        />
      </label>

      {showTripRates ? (
        <section className="trip-rates-editor">
          <div className="trip-rates-header">
            <h3>Tarifas por viaje</h3>
            <p>Importes base para viajes desde Mendoza o San Juan.</p>
          </div>

          <div className="trip-rates-grid">
            {TRIP_RATE_ORIGINS.map((origin) => (
              <article className="trip-rate-block" key={origin.key}>
                <h4>{origin.label}</h4>
                {POSITION_RANGES.map((range) => (
                  <label key={range.key}>
                    {range.label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tripRates[origin.key]?.[range.key] || ""}
                      onChange={(event) => updateTripRate(origin.key, range.key, event.target.value)}
                      placeholder="0"
                    />
                  </label>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <button className="primary-button" type="submit">
        {submitLabel}
      </button>
      <button className="ghost-button" type="button" onClick={onCancel}>
        Cancelar
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

function FormModal({ title, children, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="ghost-button modal-close" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ClientSelect({ label, clients, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedClient = clients.find((client) => client.id === value);
  const isDisabled = !clients.length;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!selectRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <label className="custom-select-field">
      {label}
      <div className="custom-select-shell" ref={selectRef}>
        <button
          className="custom-select-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={isDisabled}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{selectedClient?.name || "Carga un cliente primero"}</span>
          <span className="custom-select-arrow" aria-hidden="true" />
        </button>

        {isOpen ? (
          <div className="custom-select-menu" role="listbox">
            {clients.map((client) => (
              <button
                className={`custom-select-option ${client.id === value ? "is-selected" : ""}`}
                type="button"
                role="option"
                aria-selected={client.id === value}
                key={client.id}
                onClick={() => {
                  onChange(client.id);
                  setIsOpen(false);
                }}
              >
                {client.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function InvoiceForm({ clients, onSubmit }) {
  const [formValues, setFormValues] = useState({
    ...blankInvoice,
    clientId: clients[0]?.id || "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clients.some((client) => client.id === formValues.clientId)) {
      setFormValues((current) => ({
        ...current,
        clientId: clients[0]?.id || "",
      }));
    }
  }, [clients, formValues.clientId]);

  const selectedClient = clients.find((client) => client.id === formValues.clientId);
  const needsCargoNumber = isFecovitaClient(selectedClient);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formValues.clientId) {
      setError("Primero carga un cliente para poder facturarle.");
      return;
    }

    if (!onSubmit(formValues.clientId, formValues)) {
      setError("Completa empresa, numero y valor de la factura.");
      return;
    }

    setFormValues({
      ...blankInvoice,
      clientId: formValues.clientId,
    });
    setError("");
  };

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <ClientSelect
        label="Empresa"
        clients={clients}
        value={formValues.clientId}
        onChange={(clientId) => {
          setFormValues({ ...formValues, clientId, customerName: "", cargoNumber: "" });
          setError("");
        }}
      />

      <label>
        Nro. factura
        <input
          required
          value={formValues.invoiceNumber}
          onChange={(event) => {
            setFormValues({ ...formValues, invoiceNumber: event.target.value });
            setError("");
          }}
          placeholder="0004-00001237"
        />
      </label>

      <label>
        Fecha
        <input
          type="date"
          value={formValues.date}
          onChange={(event) => setFormValues({ ...formValues, date: event.target.value })}
        />
      </label>

      <label>
        Valor
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={formValues.amount}
          onChange={(event) => {
            setFormValues({ ...formValues, amount: event.target.value });
            setError("");
          }}
          placeholder="250000"
        />
      </label>

      {isMiscClient(selectedClient) ? (
        <label>
          Nombre del cliente
          <input
            value={formValues.customerName}
            onChange={(event) => setFormValues({ ...formValues, customerName: event.target.value })}
            placeholder="Cliente asociado"
          />
        </label>
      ) : null}

      {needsCargoNumber ? (
        <label>
          Numero de carga
          <input
            value={formValues.cargoNumber}
            onChange={(event) => setFormValues({ ...formValues, cargoNumber: event.target.value })}
            placeholder="Referencia de carga"
          />
        </label>
      ) : null}

      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={formValues.paid}
          onChange={(event) => setFormValues({ ...formValues, paid: event.target.checked })}
        />
        <span>Cargar como pagada</span>
      </label>

      <button className="primary-button" type="submit" disabled={!clients.length}>
        Agregar factura
      </button>
      {error ? <p className="form-error full-span">{error}</p> : null}
    </form>
  );
}

function TripForm({ clients, onSubmit }) {
  const [formValues, setFormValues] = useState({
    ...blankTrip,
    clientId: clients[0]?.id || "varios",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clients.some((client) => client.id === formValues.clientId) && clients[0]) {
      setFormValues((current) => ({ ...current, clientId: clients[0].id }));
    }
  }, [clients, formValues.clientId]);

  const selectedClient = clients.find((client) => client.id === formValues.clientId);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!onSubmit(formValues)) {
      setError("Completa el trayecto y el valor estimado.");
      return;
    }

    setFormValues({
      ...blankTrip,
      clientId: clients[0]?.id || "varios",
    });
    setError("");
  };

  return (
    <form className="entry-form trip-form" onSubmit={handleSubmit}>
      <ClientSelect
        label="Cliente"
        clients={clients}
        value={formValues.clientId}
        onChange={(clientId) => setFormValues({ ...formValues, clientId, customerName: "" })}
      />

      <label>
        Fecha
        <input
          type="date"
          value={formValues.date}
          onChange={(event) => setFormValues({ ...formValues, date: event.target.value })}
        />
      </label>

      <label>
        Trayecto
        <input
          required
          value={formValues.route}
          onChange={(event) => {
            setFormValues({ ...formValues, route: event.target.value });
            setError("");
          }}
          placeholder="Origen -> Destino"
        />
      </label>

      <label>
        {isMiscClient(selectedClient) ? "Valor" : "Valor sin IVA"}
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={formValues.amount}
          onChange={(event) => {
            setFormValues({ ...formValues, amount: event.target.value });
            setError("");
          }}
          placeholder="150000"
        />
      </label>

      {isMiscClient(selectedClient) ? (
        <label>
          Nombre del cliente
          <input
            value={formValues.customerName}
            onChange={(event) => setFormValues({ ...formValues, customerName: event.target.value })}
            placeholder="Cliente asociado"
          />
        </label>
      ) : null}

      <label className="full-span">
        Nota
        <input
          value={formValues.note}
          onChange={(event) => setFormValues({ ...formValues, note: event.target.value })}
          placeholder="Observacion opcional"
        />
      </label>

      <button className="primary-button" type="submit">
        Agregar viaje
      </button>
      {error ? <p className="form-error full-span">{error}</p> : null}
    </form>
  );
}

function FiscalCreditForm({ onSubmit }) {
  const [formValues, setFormValues] = useState(blankFiscalCredit);
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!onSubmit(formValues)) {
      setError("Carga un importe valido.");
      return;
    }

    setFormValues(blankFiscalCredit);
    setError("");
  };

  return (
    <form className="entry-form fiscal-credit-form" onSubmit={handleSubmit}>
      <label>
        Importe
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={formValues.amount}
          onChange={(event) => {
            setFormValues({ ...formValues, amount: event.target.value });
            setError("");
          }}
          placeholder="250000"
        />
      </label>

      <label>
        Tomar
        <select
          value={formValues.percentage}
          onChange={(event) => {
            setFormValues({ ...formValues, percentage: event.target.value });
            setError("");
          }}
        >
          {FISCAL_CREDIT_PERCENTAGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button className="primary-button" type="submit">
        Agregar credito
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

function DonutChart({ items, centerLabel, centerValue, centerDetail }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="donut-card">
      <div className="donut-chart" style={{ background: buildPieGradient(items) }}>
        <div className="donut-center">
          <span>{centerLabel}</span>
          <strong>{centerValue}</strong>
          <small>{total ? centerDetail : "Sin movimientos"}</small>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="stat-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryMetric({ label, value }) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function useDatabaseState(defaultValue) {
  const [state, setState] = useState(defaultValue);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      if (!isSupabaseConfigured) {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);
        if (storedValue && isMounted) {
          setState(mergeAppState(defaultValue, JSON.parse(storedValue)));
        }
        return;
      }

      try {
        const remoteState = await loadRemoteState();
        const nextState = mergeAppState(defaultValue, remoteState || {});

        if (!remoteState) {
          await saveRemoteState(nextState);
        }

        if (isMounted) {
          setState(nextState);
          setReady(true);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setReady(true);
        }
      }
    }

    loadState();

    return () => {
      isMounted = false;
    };
  }, [defaultValue]);

  const setAndPersistState = (updater) => {
    setState((current) => {
      const nextState = typeof updater === "function" ? updater(current) : updater;

      if (isSupabaseConfigured) {
        saveRemoteState(nextState)
          .catch((error) => console.error(error));
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      }

      return nextState;
    });
  };

  return [state, ready ? setAndPersistState : setState];
}

function mergeAppState(defaultValue, storedValue) {
  return {
    ...defaultValue,
    ...storedValue,
    profile: defaultValue.profile,
    clients: Array.isArray(storedValue.clients) ? storedValue.clients : defaultValue.clients,
    invoices: Array.isArray(storedValue.invoices) ? storedValue.invoices : defaultValue.invoices,
    unbilledTrips: Array.isArray(storedValue.unbilledTrips) ? storedValue.unbilledTrips : defaultValue.unbilledTrips,
    fiscalCredits: Array.isArray(storedValue.fiscalCredits) ? storedValue.fiscalCredits : defaultValue.fiscalCredits,
  };
}

function normalizeInvoice(values) {
  return {
    invoiceNumber: values.invoiceNumber?.trim() || "",
    date: values.date || currentDate,
    amount: Number(values.amount || 0),
    paid: Boolean(values.paid),
    customerName: values.customerName?.trim() || "",
    cargoNumber: values.cargoNumber?.trim() || "",
  };
}

function normalizeTrip(values) {
  return {
    clientId: values.clientId,
    customerName: values.customerName?.trim() || "",
    date: values.date || currentDate,
    route: values.route?.trim() || "",
    amount: Number(values.amount || 0),
    note: values.note?.trim() || "",
  };
}

function normalizeFiscalCreditPercentage(value) {
  return Number(value) === 40 ? 40 : 100;
}

function getFiscalCreditPercentage(credit) {
  return normalizeFiscalCreditPercentage(credit?.percentage);
}

function getFiscalCreditAppliedAmount(credit) {
  return Number(credit?.amount || 0) * (getFiscalCreditPercentage(credit) / 100);
}

function buildEmptyTripRates() {
  return Object.fromEntries(
    TRIP_RATE_ORIGINS.map((origin) => [
      origin.key,
      Object.fromEntries(POSITION_RANGES.map((range) => [range.key, ""])),
    ]),
  );
}

function hydrateTripRates(rates) {
  const emptyRates = buildEmptyTripRates();

  return Object.fromEntries(
    TRIP_RATE_ORIGINS.map((origin) => [
      origin.key,
      Object.fromEntries(
        POSITION_RANGES.map((range) => [
          range.key,
          rates?.[origin.key]?.[range.key] ?? emptyRates[origin.key][range.key],
        ]),
      ),
    ]),
  );
}

function normalizeTripRates(rates) {
  const hydratedRates = hydrateTripRates(rates);

  return Object.fromEntries(
    TRIP_RATE_ORIGINS.map((origin) => [
      origin.key,
      Object.fromEntries(
        POSITION_RANGES.map((range) => {
          const amount = Number(hydratedRates[origin.key][range.key] || 0);
          return [range.key, amount > 0 ? amount : ""];
        }),
      ),
    ]),
  );
}

function sumAmounts(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getTripBillableAmount(trip, client) {
  const amount = Number(trip.amount || 0);
  return isMiscClient(client) ? amount : amount * IVA_TOTAL_RATE;
}

function sumTripBillableAmounts(trips, clientsById) {
  return trips.reduce((sum, trip) => sum + getTripBillableAmount(trip, clientsById[trip.clientId]), 0);
}

function calculateIncludedVat(totalWithVat) {
  return (Number(totalWithVat || 0) * IVA_RATE) / IVA_TOTAL_RATE;
}

function isOverdueInvoice(invoice) {
  if (invoice.paid || !invoice.date) return false;

  const invoiceDate = new Date(`${invoice.date}T00:00:00`);
  if (Number.isNaN(invoiceDate.getTime())) return false;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const elapsedDays = Math.floor((todayStart - invoiceDate) / 86400000);

  return elapsedDays >= 30;
}

function isFecovitaClient(client) {
  return slugify(client?.name || "") === "fecovita";
}

function isMiscClient(client) {
  return Boolean(client?.isMisc) || slugify(client?.name || "") === "varios";
}

function getInvoiceStatusLabel(invoice) {
  if (invoice.paid) return "Pagada";
  if (isOverdueInvoice(invoice)) return "Pendiente";
  return "En termino";
}

function getInvoiceStatusTone(invoice) {
  if (invoice.paid) return "ok";
  if (isOverdueInvoice(invoice)) return "warning";
  return "soft";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildClientId(name, clients) {
  const base = slugify(name) || "cliente";
  let candidate = base;
  let suffix = 2;

  while (clients.some((client) => client.id === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function createRecordId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function buildPieGradient(items) {
  if (!items.length) {
    return "conic-gradient(#d7cebb 0 100%)";
  }

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let cursor = 0;

  const segments = items.map((item, index) => {
    const start = cursor;
    const span = total ? (Number(item.value) / total) * 100 : 0;
    cursor += span;
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatUsdFromArs(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value || 0) / ARS_PER_USD));
}

function formatShare(value, total) {
  if (!total) return "0%";

  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number(value || 0) / total);
}

function formatPercent(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatMonth(value) {
  if (!value) return "sin periodo";
  const [year, month] = value.split("-");
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

const chartColors = ["#0f5f4b", "#2eb384", "#c86f1c", "#e88902", "#627088", "#d7dde5"];

export default App;
