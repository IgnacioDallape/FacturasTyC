import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, loadRemoteState, saveRemoteState } from "./lib/supabase";

const STORAGE_KEY = "remitos-facturas-state-v1";
const ARS_PER_USD = 1100;

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
};

const blankInvoice = {
  invoiceNumber: "",
  date: currentDate,
  amount: "",
  paid: false,
  customerName: "",
};

const blankTrip = {
  clientId: "ypf",
  customerName: "",
  date: currentDate,
  route: "",
  amount: "",
  note: "",
};

function App() {
  const [appState, setAppState] = useDatabaseState(initialState);
  const [activeView, setActiveView] = useState("dashboard");
  const selectedMonth = currentMonth;

  const clients = appState.clients || [];
  const invoices = appState.invoices || [];
  const unbilledTrips = appState.unbilledTrips || [];

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

        return {
          ...client,
          totalDue: sumAmounts(unpaidInvoices),
          monthTotal: sumAmounts(monthlyInvoices),
          pendingCount: unpaidInvoices.length,
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
    () => sumAmounts(unbilledPendingTrips),
    [unbilledPendingTrips],
  );

  const donutItems = useMemo(
    () =>
      dashboardSummary
        .filter((client) => client.totalDue > 0)
        .map((client) => ({
          label: client.name,
          value: client.totalDue,
          detail: `${client.pendingCount} pendientes`,
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
          isMisc: false,
        },
      ],
    }));

    return clientId;
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
        </div>
      </header>

      {activeView === "dashboard" ? (
        <DashboardView
          selectedMonth={selectedMonth}
          totalUnpaid={totalUnpaid}
          totalMonthlyBilled={totalMonthlyBilled}
          unbilledTripsAmount={unbilledTripsAmount}
          pendingTrips={unbilledPendingTrips}
          summary={dashboardSummary}
          donutItems={donutItems}
        />
      ) : activeView === "clientes" ? (
        <ClientsView
          clients={clients}
          invoices={invoices}
          selectedMonth={selectedMonth}
          onAddClient={addClient}
          onAddInvoice={addInvoice}
          onToggleInvoicePaid={toggleInvoicePaid}
          onDeleteInvoice={deleteInvoice}
        />
      ) : (
        <TripsView
          clients={clients}
          unbilledTrips={unbilledTrips}
          onAddTrip={addTrip}
          onToggleTripBilled={toggleTripBilled}
          onDeleteTrip={deleteTrip}
        />
      )}
    </div>
  );
}

function DashboardView({
  selectedMonth,
  totalUnpaid,
  totalMonthlyBilled,
  unbilledTripsAmount,
  pendingTrips,
  summary,
  donutItems,
}) {
  const pendingClients = summary.filter((client) => client.totalDue > 0);

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
          label="Monto no facturado"
          value={formatCurrency(unbilledTripsAmount)}
          detail="Viajes realizados pendientes"
          tone="orange"
        />
        <MetricCard label="Viajes no facturados" value={String(pendingTrips.length)} detail="Listos para revisar" tone="slate" />
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
            </div>

            <div className="client-breakdown">
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
                </div>
              ) : (
                <EmptyState
                  title="Sin deuda pendiente"
                  message="Todas las facturas cargadas figuran como cobradas."
                />
              )}
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
  onAddInvoice,
  onToggleInvoicePaid,
  onDeleteInvoice,
}) {
  const [showClientForm, setShowClientForm] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState("");

  const createClient = (name) => {
    const clientId = onAddClient(name);
    if (!clientId) return false;

    setExpandedClientId(clientId);
    setShowClientForm(false);
    return true;
  };

  const createInvoice = (clientId, values) => {
    const wasCreated = onAddInvoice(clientId, values);
    if (!wasCreated) return false;

    setExpandedClientId(clientId);
    return true;
  };

  return (
    <main className="layout-stack">
      <section className="clients-actions">
        <div className="clients-action-stack">
          {!showClientForm ? (
            <button className="primary-button" type="button" onClick={() => setShowClientForm(true)}>
              Agregar cliente
            </button>
          ) : (
            <ClientForm onSubmit={createClient} onCancel={() => setShowClientForm(false)} />
          )}

          <details className="invoice-form-toggle global-invoice-form">
            <summary>
              <span>Agregar factura</span>
              <span className="disclosure-arrow small" aria-hidden="true" />
            </summary>
            <InvoiceForm clients={clients} onSubmit={createInvoice} />
          </details>
        </div>
      </section>

      <section className="client-list">
        {clients.map((client) => {
          const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
          const monthlyTotal = sumAmounts(clientInvoices.filter((invoice) => invoice.date?.startsWith(selectedMonth)));
          const unpaidInvoices = clientInvoices.filter((invoice) => !invoice.paid);
          const overdueInvoices = unpaidInvoices.filter(isOverdueInvoice);
          const overdueTotal = sumAmounts(overdueInvoices);
          const pending = unpaidInvoices.length;

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
                <SummaryMetric label="Total vencido" value={formatCurrency(overdueTotal)} />
                <span className={`status-pill ${pending ? "warning" : "ok"}`}>
                  {pending ? `${pending} pendientes` : "Al dia"}
                </span>
                <span className="disclosure-arrow" aria-hidden="true" />
              </summary>

              <div className="client-details">
                <div className="mini-stats">
                  <StatBox label="Total vencido" value={formatCurrency(overdueTotal)} />
                  <StatBox label="Facturado del mes" value={formatCurrency(monthlyTotal)} />
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
                          {client.isMisc && invoice.customerName ? (
                            <p className="invoice-customer">{invoice.customerName}</p>
                          ) : null}
                          <span className={`status-pill ${invoice.paid ? "ok" : "warning"}`}>
                            {invoice.paid ? "Pagada" : "Pendiente"}
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
  const [expandedClientId, setExpandedClientId] = useState("");

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
        <div className="clients-action-stack">
          <details className="invoice-form-toggle global-invoice-form">
            <summary>
              <span>Agregar viaje no facturado</span>
              <span className="disclosure-arrow small" aria-hidden="true" />
            </summary>
            <TripForm clients={clients} onSubmit={onAddTrip} />
          </details>
        </div>
      </section>

      <section className="client-list">
        {clients.map((client) => {
          const clientTrips = unbilledTrips.filter((trip) => trip.clientId === client.id);
          const unbilledClientTrips = clientTrips.filter((trip) => !trip.billed);
          const totalUnbilled = sumAmounts(unbilledClientTrips);
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
                <SummaryMetric label="Total no facturado" value={formatCurrency(totalUnbilled)} />
                <span className={`status-pill ${pending ? "warning" : "ok"}`}>
                  {pending ? `${pending} viajes` : "Al dia"}
                </span>
                <span className="disclosure-arrow" aria-hidden="true" />
              </summary>

              <div className="client-details">
                <div className="mini-stats">
                  <StatBox label="Total no facturado" value={formatCurrency(totalUnbilled)} />
                  <StatBox label="Viajes pendientes" value={String(pending)} />
                </div>

                <div className="trip-list">
                  {clientTrips.length ? (
                    clientTrips.map((trip) => (
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
                            <small>Monto</small>
                            <strong>{formatCurrency(trip.amount)}</strong>
                          </span>
                          <span className="disclosure-arrow small" aria-hidden="true" />
                        </summary>
                        <div className="invoice-row-details">
                          <div className="trip-detail-copy">
                            {client.isMisc && trip.customerName ? <p className="invoice-customer">{trip.customerName}</p> : null}
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
                    ))
                  ) : (
                    <EmptyState title="Sin viajes" message="Carga el primer viaje pendiente de este cliente." />
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

function ClientForm({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!onSubmit(name)) {
      setError("Escribi un cliente nuevo para agregarlo.");
      return;
    }

    setName("");
    setError("");
  };

  return (
    <form className="client-create-form" onSubmit={handleSubmit}>
      <label htmlFor="new-client">
        Nuevo cliente
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
      <button className="primary-button" type="submit">
        Crear cliente
      </button>
      <button className="ghost-button" type="button" onClick={onCancel}>
        Cancelar
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
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
      <label>
        Empresa
        <select
          required
          value={formValues.clientId}
          onChange={(event) => {
            setFormValues({ ...formValues, clientId: event.target.value, customerName: "" });
            setError("");
          }}
          disabled={!clients.length}
        >
          {clients.length ? (
            clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))
          ) : (
            <option value="">Carga un cliente primero</option>
          )}
        </select>
      </label>

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

      {selectedClient?.isMisc ? (
        <label>
          Nombre del cliente
          <input
            value={formValues.customerName}
            onChange={(event) => setFormValues({ ...formValues, customerName: event.target.value })}
            placeholder="Cliente asociado"
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
      <label>
        Cliente
        <select
          value={formValues.clientId}
          onChange={(event) => setFormValues({ ...formValues, clientId: event.target.value })}
        >
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
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
        Valor estimado
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

      {selectedClient?.isMisc ? (
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
  };
}

function normalizeInvoice(values) {
  return {
    invoiceNumber: values.invoiceNumber?.trim() || "",
    date: values.date || currentDate,
    amount: Number(values.amount || 0),
    paid: Boolean(values.paid),
    customerName: values.customerName?.trim() || "",
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

function sumAmounts(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
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
