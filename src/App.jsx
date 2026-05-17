import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nutri-atelier-state";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "products", label: "Productos", icon: "box" },
  { id: "stock", label: "Stock", icon: "layers" },
  { id: "purchases", label: "Compras", icon: "cart" },
  { id: "costs", label: "Costos", icon: "chart" },
  { id: "tasks", label: "Tareas", icon: "check" },
  { id: "planning", label: "Planificacion", icon: "calendar" },
  { id: "settings", label: "Configuracion", icon: "gear" },
];

const initialState = {
  profile: {
    studioName: "Nutri Atelier",
    owner: "Valentina Rossi",
    focus: "Nutricion consciente y productos funcionales",
  },
  login: {
    email: "hola@nutriatelier.com",
  },
  products: [
    {
      id: "p1",
      name: "Granola Premium",
      category: "Despensa saludable",
      cost: 4.2,
      price: 8.9,
      stock: 14,
      minStock: 10,
      unit: "packs",
      supplier: "Natural Fields",
      expiry: "2026-06-18",
      notes: "Blend con frutos secos y semillas activadas.",
    },
    {
      id: "p2",
      name: "Mix Proteico Cacao",
      category: "Suplementos",
      cost: 11.5,
      price: 22,
      stock: 6,
      minStock: 8,
      unit: "frascos",
      supplier: "Bio Source",
      expiry: "2026-08-05",
      notes: "Se usa en recomendaciones post entrenamiento.",
    },
    {
      id: "p3",
      name: "Harina de almendras",
      category: "Insumos",
      cost: 6.8,
      price: 12.5,
      stock: 18,
      minStock: 12,
      unit: "kg",
      supplier: "Alma Organica",
      expiry: "2026-09-30",
      notes: "Base para recetas low carb.",
    },
    {
      id: "p4",
      name: "Kombucha citrus",
      category: "Bebidas",
      cost: 2.5,
      price: 5.8,
      stock: 9,
      minStock: 9,
      unit: "botellas",
      supplier: "Fermenta Lab",
      expiry: "2026-05-29",
      notes: "Ideal para combos semanales.",
    },
  ],
  movements: [
    { id: "m1", productId: "p1", type: "entry", quantity: 10, date: "2026-05-11", note: "Reposicion semanal" },
    { id: "m2", productId: "p2", type: "usage", quantity: 2, date: "2026-05-12", note: "Muestras de consultorio" },
    { id: "m3", productId: "p4", type: "usage", quantity: 4, date: "2026-05-15", note: "Pedido detox" },
  ],
  purchases: [
    {
      id: "buy1",
      item: "Proteina vegetal vainilla",
      supplier: "Bio Source",
      quantity: 8,
      estimatedCost: 92,
      status: "pending",
      dueDate: "2026-05-20",
    },
    {
      id: "buy2",
      item: "Etiquetas kraft",
      supplier: "Casa Grafica",
      quantity: 100,
      estimatedCost: 26,
      status: "done",
      dueDate: "2026-05-10",
    },
  ],
  expenses: [
    { id: "e1", name: "Compra de semillas", category: "Insumos", amount: 84, date: "2026-05-03" },
    { id: "e2", name: "Envases de vidrio", category: "Compras", amount: 47, date: "2026-05-08" },
    { id: "e3", name: "Fotografia de producto", category: "Otros", amount: 60, date: "2026-05-13" },
    { id: "e4", name: "Endulzantes naturales", category: "Insumos", amount: 31, date: "2026-05-16" },
  ],
  tasks: [
    { id: "t1", title: "Revisar stock de suplementos", priority: "Alta", dueDate: "2026-05-17", done: false, view: "Hoy" },
    { id: "t2", title: "Actualizar precios del invierno", priority: "Media", dueDate: "2026-05-19", done: false, view: "Semana" },
    { id: "t3", title: "Preparar pedidos de suscripcion", priority: "Alta", dueDate: "2026-05-18", done: true, view: "Hoy" },
    { id: "t4", title: "Comprar insumos secos", priority: "Baja", dueDate: "2026-05-21", done: false, view: "Semana" },
  ],
  notes: [
    { id: "n1", title: "Lanzamiento junio", body: "Armar pack desayuno funcional con recetario digital y descuento por lanzamiento." },
    { id: "n2", title: "Recordatorio", body: "Confirmar entrega de proveedor Alma Organica los martes por la manana." },
  ],
  reminders: [
    { id: "r1", title: "Llamar a proveedor de kombucha", date: "2026-05-18" },
    { id: "r2", title: "Subir menu semanal a Instagram", date: "2026-05-20" },
  ],
  weeklyPlan: [
    { id: "w1", day: "Lunes", focus: "Planificar compras y costos" },
    { id: "w2", day: "Martes", focus: "Produccion de snacks y control de stock" },
    { id: "w3", day: "Miercoles", focus: "Consultas y seguimiento de clientas" },
    { id: "w4", day: "Jueves", focus: "Armado de pedidos y packaging" },
    { id: "w5", day: "Viernes", focus: "Analisis de gastos y agenda de contenidos" },
  ],
  settings: {
    currency: "USD",
    lowStockAlerts: true,
    theme: "Luz natural",
  },
};

const productTemplate = {
  name: "",
  category: "",
  cost: "",
  price: "",
  stock: "",
  minStock: "",
  unit: "",
  supplier: "",
  expiry: "",
  notes: "",
};

const taskTemplate = {
  title: "",
  priority: "Media",
  dueDate: "",
  done: false,
  view: "Semana",
};

const purchaseTemplate = {
  item: "",
  supplier: "",
  quantity: "",
  estimatedCost: "",
  status: "pending",
  dueDate: "",
};

const expenseTemplate = {
  name: "",
  category: "Insumos",
  amount: "",
  date: "",
};

const noteTemplate = {
  title: "",
  body: "",
};

function App() {
  const [appState, setAppState] = usePersistedState(STORAGE_KEY, initialState);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const lowStockProducts = useMemo(
    () => appState.products.filter((product) => Number(product.stock) <= Number(product.minStock)),
    [appState.products],
  );

  const monthlyCosts = useMemo(
    () => appState.expenses.reduce((total, expense) => total + Number(expense.amount), 0),
    [appState.expenses],
  );

  const pendingPurchases = useMemo(
    () => appState.purchases.filter((purchase) => purchase.status === "pending"),
    [appState.purchases],
  );

  const openTasks = useMemo(
    () => appState.tasks.filter((task) => !task.done),
    [appState.tasks],
  );

  const inventoryValue = useMemo(
    () =>
      appState.products.reduce(
        (total, product) => total + Number(product.cost) * Number(product.stock),
        0,
      ),
    [appState.products],
  );

  const costBreakdown = useMemo(() => {
    const totals = appState.expenses.reduce((acc, expense) => {
      const category = expense.category || "Otros";
      acc[category] = (acc[category] || 0) + Number(expense.amount);
      return acc;
    }, {});

    return Object.entries(totals).map(([category, amount]) => ({ category, amount }));
  }, [appState.expenses]);

  const purchaseSuggestions = useMemo(
    () =>
      lowStockProducts.map((product) => ({
        id: `suggested-${product.id}`,
        item: product.name,
        supplier: product.supplier,
        quantity: Math.max(Number(product.minStock) * 2 - Number(product.stock), 1),
        estimatedCost: (Math.max(Number(product.minStock) * 2 - Number(product.stock), 1) * Number(product.cost)).toFixed(2),
      })),
    [lowStockProducts],
  );

  const updateState = (key, value) => {
    setAppState((current) => ({ ...current, [key]: value }));
  };

  const saveProduct = (formValues) => {
    const parsedProduct = {
      ...formValues,
      cost: Number(formValues.cost),
      price: Number(formValues.price),
      stock: Number(formValues.stock),
      minStock: Number(formValues.minStock),
    };

    if (editingProduct) {
      updateState(
        "products",
        appState.products.map((product) =>
          product.id === editingProduct.id ? { ...editingProduct, ...parsedProduct } : product,
        ),
      );
    } else {
      updateState("products", [
        {
          id: crypto.randomUUID(),
          ...parsedProduct,
        },
        ...appState.products,
      ]);
    }

    setEditingProduct(null);
    setShowProductModal(false);
  };

  const deleteProduct = (productId) => {
    updateState(
      "products",
      appState.products.filter((product) => product.id !== productId),
    );
  };

  const saveTask = (formValues) => {
    updateState("tasks", [
      {
        id: crypto.randomUUID(),
        ...formValues,
      },
      ...appState.tasks,
    ]);
    setShowTaskModal(false);
  };

  const toggleTask = (taskId) => {
    updateState(
      "tasks",
      appState.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    );
  };

  const savePurchase = (formValues) => {
    updateState("purchases", [
      {
        id: crypto.randomUUID(),
        ...formValues,
        quantity: Number(formValues.quantity),
        estimatedCost: Number(formValues.estimatedCost),
      },
      ...appState.purchases,
    ]);
    setShowPurchaseModal(false);
  };

  const togglePurchaseStatus = (purchaseId) => {
    updateState(
      "purchases",
      appState.purchases.map((purchase) =>
        purchase.id === purchaseId
          ? { ...purchase, status: purchase.status === "pending" ? "done" : "pending" }
          : purchase,
      ),
    );
  };

  const saveExpense = (formValues) => {
    updateState("expenses", [
      {
        id: crypto.randomUUID(),
        ...formValues,
        amount: Number(formValues.amount),
      },
      ...appState.expenses,
    ]);
    setShowExpenseModal(false);
  };

  const saveNote = (formValues) => {
    updateState("notes", [{ id: crypto.randomUUID(), ...formValues }, ...appState.notes]);
    setShowNoteModal(false);
  };

  const saveMovement = (productId, type, quantity, note) => {
    const numericQuantity = Number(quantity);

    updateState(
      "products",
      appState.products.map((product) =>
        product.id === productId
          ? {
              ...product,
              stock:
                type === "entry"
                  ? Number(product.stock) + numericQuantity
                  : Math.max(Number(product.stock) - numericQuantity, 0),
            }
          : product,
      ),
    );

    updateState("movements", [
      {
        id: crypto.randomUUID(),
        productId,
        type,
        quantity: numericQuantity,
        date: new Date().toISOString().slice(0, 10),
        note,
      },
      ...appState.movements,
    ]);
  };

  const saveSettings = (field, value) => {
    updateState("settings", { ...appState.settings, [field]: value });
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="brand-card">
          <div className="brand-mark">N</div>
          <div>
            <p className="eyebrow">Estudio de gestion</p>
            <h1>{appState.profile.studioName}</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveSection(item.id);
                setMenuOpen(false);
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <p className="eyebrow">A cargo</p>
            <strong>{appState.profile.owner}</strong>
          </div>
          <span className="badge muted">Panel listo para usar</span>
        </div>
      </aside>

      <main className="content">
        <TopBar
          title={sectionTitles[activeSection]}
          description={sectionDescriptions[activeSection]}
          onMenuClick={() => setMenuOpen(true)}
        />

        {activeSection === "dashboard" && (
          <DashboardView
            products={appState.products}
            lowStockProducts={lowStockProducts}
            monthlyCosts={monthlyCosts}
            pendingPurchases={pendingPurchases}
            openTasks={openTasks}
            inventoryValue={inventoryValue}
            costBreakdown={costBreakdown}
            reminders={appState.reminders}
          />
        )}

        {activeSection === "products" && (
          <ProductsView
            products={appState.products}
            onCreate={() => {
              setEditingProduct(null);
              setShowProductModal(true);
            }}
            onEdit={(product) => {
              setEditingProduct(product);
              setShowProductModal(true);
            }}
            onDelete={deleteProduct}
          />
        )}

        {activeSection === "stock" && (
          <StockView
            products={appState.products}
            movements={appState.movements}
            onMovement={saveMovement}
          />
        )}

        {activeSection === "purchases" && (
          <PurchasesView
            purchases={appState.purchases}
            suggestions={purchaseSuggestions}
            onCreate={() => setShowPurchaseModal(true)}
            onToggle={togglePurchaseStatus}
            onUseSuggestion={(suggestion) => {
              savePurchase({ ...suggestion, status: "pending", dueDate: new Date().toISOString().slice(0, 10) });
            }}
          />
        )}

        {activeSection === "costs" && (
          <CostsView
            expenses={appState.expenses}
            monthlyCosts={monthlyCosts}
            costBreakdown={costBreakdown}
            onCreate={() => setShowExpenseModal(true)}
          />
        )}

        {activeSection === "tasks" && (
          <TasksView tasks={appState.tasks} onCreate={() => setShowTaskModal(true)} onToggle={toggleTask} />
        )}

        {activeSection === "planning" && (
          <PlanningView
            notes={appState.notes}
            reminders={appState.reminders}
            weeklyPlan={appState.weeklyPlan}
            onCreateNote={() => setShowNoteModal(true)}
          />
        )}

        {activeSection === "settings" && (
          <SettingsView settings={appState.settings} profile={appState.profile} onSave={saveSettings} />
        )}
      </main>

      {showProductModal && (
        <Modal
          title={editingProduct ? "Editar producto" : "Nuevo producto"}
          subtitle="Completá la ficha completa para mantener control de costos, stock y proveedor."
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
        >
          <ProductForm
            initialValues={editingProduct || productTemplate}
            onSubmit={saveProduct}
            onCancel={() => {
              setShowProductModal(false);
              setEditingProduct(null);
            }}
          />
        </Modal>
      )}

      {showTaskModal && (
        <Modal
          title="Nueva tarea"
          subtitle="Organizá acciones operativas y prioridades sin perder de vista la semana."
          onClose={() => setShowTaskModal(false)}
        >
          <TaskForm initialValues={taskTemplate} onSubmit={saveTask} onCancel={() => setShowTaskModal(false)} />
        </Modal>
      )}

      {showPurchaseModal && (
        <Modal
          title="Nueva compra"
          subtitle="Registrá insumos pendientes con costo estimado y proveedor asociado."
          onClose={() => setShowPurchaseModal(false)}
        >
          <PurchaseForm
            initialValues={purchaseTemplate}
            onSubmit={savePurchase}
            onCancel={() => setShowPurchaseModal(false)}
          />
        </Modal>
      )}

      {showExpenseModal && (
        <Modal
          title="Registrar costo"
          subtitle="Sumá gastos de insumos, compras y otros movimientos del negocio."
          onClose={() => setShowExpenseModal(false)}
        >
          <ExpenseForm
            initialValues={expenseTemplate}
            onSubmit={saveExpense}
            onCancel={() => setShowExpenseModal(false)}
          />
        </Modal>
      )}

      {showNoteModal && (
        <Modal
          title="Nueva nota"
          subtitle="Guardá ideas, recordatorios e informacion importante del emprendimiento."
          onClose={() => setShowNoteModal(false)}
        >
          <NoteForm initialValues={noteTemplate} onSubmit={saveNote} onCancel={() => setShowNoteModal(false)} />
        </Modal>
      )}
    </div>
  );
}

const sectionTitles = {
  dashboard: "Dashboard",
  products: "Productos",
  stock: "Control de stock",
  purchases: "Planificacion de compras",
  costs: "Control de costos",
  tasks: "Gestion de tareas",
  planning: "Organizacion general",
  settings: "Configuracion",
};

const sectionDescriptions = {
  dashboard: "Una vista clara del estado general del negocio, con alertas, costos y pendientes clave.",
  products: "Catalogo completo con datos operativos, margen y proveedor por producto.",
  stock: "Movimientos, inventario actualizado y alertas automaticas de reposicion.",
  purchases: "Compras pendientes, sugerencias por stock minimo y seguimiento simple.",
  costs: "Analisis visual de gastos por categoria y control mensual del emprendimiento.",
  tasks: "Prioridades del dia y la semana en una vista ordenada y accionable.",
  planning: "Notas, recordatorios y foco semanal para mantener el negocio alineado.",
  settings: "Ajustes base de la experiencia y preferencias del negocio.",
};

function TopBar({ title, description, onMenuClick }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button mobile-only" onClick={onMenuClick}>
          <Icon name="menu" />
        </button>
        <div>
          <p className="eyebrow">Panel principal</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="search-chip">
          <Icon name="spark" />
          <span>Orden premium para tu negocio</span>
        </div>
        <div className="avatar-pill">VR</div>
      </div>
    </header>
  );
}

function DashboardView({
  products,
  lowStockProducts,
  monthlyCosts,
  pendingPurchases,
  openTasks,
  inventoryValue,
  costBreakdown,
  reminders,
}) {
  return (
    <section className="view-grid">
      <div className="stats-grid">
        <StatCard label="Stock total" value={`${products.length} productos`} detail={`${lowStockProducts.length} en alerta`} icon="box" />
        <StatCard label="Costos del mes" value={formatCurrency(monthlyCosts)} detail="Gasto operativo actual" icon="chart" />
        <StatCard label="Compras pendientes" value={String(pendingPurchases.length)} detail="Por confirmar esta semana" icon="cart" />
        <StatCard label="Valor de inventario" value={formatCurrency(inventoryValue)} detail="Valorizado al costo" icon="spark" />
      </div>

      <div className="hero-card">
        <div>
          <span className="badge">Vista general</span>
          <h3>Todo el negocio en equilibrio</h3>
          <p>
            Seguí el pulso del emprendimiento con una lectura amable: alertas de stock, costos recientes y tareas que sostienen la operacion.
          </p>
        </div>
        <div className="hero-metrics">
          <MiniMetric label="Tareas abiertas" value={openTasks.length} />
          <MiniMetric label="Alertas stock" value={lowStockProducts.length} />
          <MiniMetric label="Recordatorios" value={reminders.length} />
        </div>
      </div>

      <Card title="Productos con stock bajo" actionLabel="Atencion prioritaria">
        {lowStockProducts.length ? (
          <div className="list-stack">
            {lowStockProducts.map((product) => (
              <div className="list-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <p>
                    {product.stock} {product.unit} disponibles de {product.minStock} minimos
                  </p>
                </div>
                <span className="status-pill warning">Reponer</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Todo en orden" message="No hay productos por debajo del stock minimo." />
        )}
      </Card>

      <Card title="Costos por categoria" actionLabel="Resumen visual">
        <SimpleBarChart items={costBreakdown} />
      </Card>

      <Card title="Compras pendientes" actionLabel="Pendientes">
        {pendingPurchases.length ? (
          <div className="list-stack">
            {pendingPurchases.map((purchase) => (
              <div className="list-row" key={purchase.id}>
                <div>
                  <strong>{purchase.item}</strong>
                  <p>
                    {purchase.quantity} unidades · {purchase.supplier}
                  </p>
                </div>
                <div className="list-meta">
                  <strong>{formatCurrency(purchase.estimatedCost)}</strong>
                  <small>{formatDate(purchase.dueDate)}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin pendientes" message="No hay compras abiertas para esta semana." />
        )}
      </Card>

      <Card title="Tareas activas" actionLabel="Semana">
        <div className="task-preview">
          {openTasks.slice(0, 4).map((task) => (
            <div className="task-preview-item" key={task.id}>
              <span className={`priority-dot ${task.priority.toLowerCase()}`} />
              <div>
                <strong>{task.title}</strong>
                <p>
                  {task.priority} · {formatDate(task.dueDate)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function ProductsView({ products, onCreate, onEdit, onDelete }) {
  return (
    <section className="view-stack">
      <SectionHeader
        title="Catalogo y ficha tecnica"
        text="Administrá cada producto con datos clave para rentabilidad, control de stock y orden operativo."
        actionLabel="Nuevo producto"
        onAction={onCreate}
      />

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoria</th>
              <th>Costo</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Proveedor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                  <span>{product.unit}</span>
                </td>
                <td>{product.category}</td>
                <td>{formatCurrency(product.cost)}</td>
                <td>{formatCurrency(product.price)}</td>
                <td>
                  <span className={`status-pill ${Number(product.stock) <= Number(product.minStock) ? "warning" : "ok"}`}>
                    {product.stock} / min {product.minStock}
                  </span>
                </td>
                <td>{product.supplier}</td>
                <td>
                  <div className="table-actions">
                    <button className="ghost-button" onClick={() => onEdit(product)}>
                      Editar
                    </button>
                    <button className="ghost-button danger" onClick={() => onDelete(product.id)}>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StockView({ products, movements, onMovement }) {
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState("entry");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!products.find((product) => product.id === selectedProduct)) {
      setSelectedProduct(products[0]?.id || "");
    }
  }, [products, selectedProduct]);

  const submitMovement = (event) => {
    event.preventDefault();
    if (!selectedProduct || !quantity) return;
    onMovement(selectedProduct, type, quantity, note || "Movimiento manual");
    setQuantity(1);
    setNote("");
  };

  return (
    <section className="view-grid">
      <Card title="Registrar movimiento" actionLabel="Entrada o salida">
        <form className="form-grid" onSubmit={submitMovement}>
          <label>
            Producto
            <select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="entry">Entrada</option>
              <option value="usage">Salida o uso</option>
            </select>
          </label>
          <label>
            Cantidad
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label className="full-width">
            Nota
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej: produccion semanal o pedido cliente" />
          </label>
          <button className="primary-button" type="submit">
            Guardar movimiento
          </button>
        </form>
      </Card>

      <Card title="Inventario actual" actionLabel="Vista clara">
        <div className="inventory-list">
          {products.map((product) => (
            <div className="inventory-item" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <p>
                  {product.category} · {product.stock} {product.unit}
                </p>
              </div>
              <div className="inventory-progress">
                <div className="progress-track">
                  <span
                    className={`progress-fill ${Number(product.stock) <= Number(product.minStock) ? "is-warning" : ""}`}
                    style={{ width: `${Math.min((Number(product.stock) / (Number(product.minStock) * 2 || 1)) * 100, 100)}%` }}
                  />
                </div>
                <small>Minimo {product.minStock}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Historial de movimientos" actionLabel="Reciente">
        <div className="list-stack">
          {movements.map((movement) => {
            const product = products.find((item) => item.id === movement.productId);
            return (
              <div className="list-row" key={movement.id}>
                <div>
                  <strong>{product?.name || "Producto"}</strong>
                  <p>{movement.note}</p>
                </div>
                <div className="list-meta">
                  <span className={`status-pill ${movement.type === "entry" ? "ok" : "warning"}`}>
                    {movement.type === "entry" ? "+" : "-"}
                    {movement.quantity}
                  </span>
                  <small>{formatDate(movement.date)}</small>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

function PurchasesView({ purchases, suggestions, onCreate, onToggle, onUseSuggestion }) {
  return (
    <section className="view-grid">
      <Card title="Lista de compras" actionLabel="Pendientes">
        <SectionHeader
          title="Plan de reposicion"
          text="Concentrá cada compra con proveedor, costo estimado y estado."
          actionLabel="Nueva compra"
          onAction={onCreate}
          compact
        />
        <div className="list-stack">
          {purchases.map((purchase) => (
            <div className="list-row elevated" key={purchase.id}>
              <div>
                <strong>{purchase.item}</strong>
                <p>
                  {purchase.quantity} unidades · {purchase.supplier}
                </p>
              </div>
              <div className="list-meta">
                <strong>{formatCurrency(purchase.estimatedCost)}</strong>
                <button className="ghost-button" onClick={() => onToggle(purchase.id)}>
                  {purchase.status === "pending" ? "Marcar realizada" : "Reabrir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Sugerencias automaticas" actionLabel="Stock minimo">
        {suggestions.length ? (
          <div className="list-stack">
            {suggestions.map((suggestion) => (
              <div className="list-row" key={suggestion.id}>
                <div>
                  <strong>{suggestion.item}</strong>
                  <p>
                    {suggestion.quantity} sugeridas · {suggestion.supplier}
                  </p>
                </div>
                <button className="primary-button subtle" onClick={() => onUseSuggestion(suggestion)}>
                  Agregar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin sugerencias" message="No hay reposiciones sugeridas en este momento." />
        )}
      </Card>
    </section>
  );
}

function CostsView({ expenses, monthlyCosts, costBreakdown, onCreate }) {
  const topExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0];

  return (
    <section className="view-grid">
      <div className="stats-grid">
        <StatCard label="Total del periodo" value={formatCurrency(monthlyCosts)} detail="Acumulado del mes" icon="chart" />
        <StatCard label="Movimientos" value={String(expenses.length)} detail="Registros de costos" icon="layers" />
        <StatCard label="Mayor gasto" value={topExpense ? formatCurrency(topExpense.amount) : formatCurrency(0)} detail={topExpense?.name || "Sin datos"} icon="spark" />
      </div>

      <Card title="Registrar nuevo costo" actionLabel="Control simple">
        <p className="support-text">
          Sumá gastos por insumos, compras u otros conceptos para sostener una mirada financiera clara.
        </p>
        <button className="primary-button" onClick={onCreate}>
          Cargar costo
        </button>
      </Card>

      <Card title="Distribucion de gastos" actionLabel="Visual">
        <SimpleBarChart items={costBreakdown} />
      </Card>

      <Card title="Detalle del periodo" actionLabel="Ultimos registros">
        <div className="list-stack">
          {expenses.map((expense) => (
            <div className="list-row" key={expense.id}>
              <div>
                <strong>{expense.name}</strong>
                <p>{expense.category}</p>
              </div>
              <div className="list-meta">
                <strong>{formatCurrency(expense.amount)}</strong>
                <small>{formatDate(expense.date)}</small>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function TasksView({ tasks, onCreate, onToggle }) {
  const today = tasks.filter((task) => task.view === "Hoy");
  const week = tasks.filter((task) => task.view === "Semana");

  return (
    <section className="view-grid">
      <Card title="Tareas del dia" actionLabel="Foco">
        <SectionHeader
          title="Acciones prioritarias"
          text="Pequenas decisiones bien organizadas sostienen una operacion fluida."
          actionLabel="Nueva tarea"
          onAction={onCreate}
          compact
        />
        <TaskList items={today} onToggle={onToggle} />
      </Card>

      <Card title="Tablero semanal" actionLabel="Panorama">
        <TaskList items={week} onToggle={onToggle} />
      </Card>
    </section>
  );
}

function PlanningView({ notes, reminders, weeklyPlan, onCreateNote }) {
  return (
    <section className="view-grid">
      <Card title="Notas importantes" actionLabel="Centralizado">
        <SectionHeader
          title="Base de ideas y recordatorios"
          text="Un espacio amable para anotar lo importante y no perder claridad."
          actionLabel="Nueva nota"
          onAction={onCreateNote}
          compact
        />
        <div className="notes-grid">
          {notes.map((note) => (
            <article className="note-card" key={note.id}>
              <strong>{note.title}</strong>
              <p>{note.body}</p>
            </article>
          ))}
        </div>
      </Card>

      <Card title="Recordatorios" actionLabel="Proximos">
        <div className="list-stack">
          {reminders.map((reminder) => (
            <div className="list-row" key={reminder.id}>
              <div>
                <strong>{reminder.title}</strong>
                <p>Agenda sensible del negocio</p>
              </div>
              <small>{formatDate(reminder.date)}</small>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Plan semanal" actionLabel="Ritmo operativo">
        <div className="weekly-plan">
          {weeklyPlan.map((item) => (
            <div className="weekly-item" key={item.id}>
              <span>{item.day}</span>
              <strong>{item.focus}</strong>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function SettingsView({ settings, profile, onSave }) {
  return (
    <section className="view-grid">
      <Card title="Preferencias del negocio" actionLabel="Ajustes">
        <div className="settings-stack">
          <label>
            Nombre del estudio
            <input value={profile.studioName} readOnly />
          </label>
          <label>
            Moneda
            <select value={settings.currency} onChange={(event) => onSave("currency", event.target.value)}>
              <option>USD</option>
              <option>ARS</option>
              <option>EUR</option>
            </select>
          </label>
          <label>
            Estilo visual
            <select value={settings.theme} onChange={(event) => onSave("theme", event.target.value)}>
              <option>Luz natural</option>
              <option>Soft editorial</option>
              <option>Minimal studio</option>
            </select>
          </label>
          <label className="switch-row">
            <span>Alertas de stock bajo</span>
            <input
              type="checkbox"
              checked={settings.lowStockAlerts}
              onChange={(event) => onSave("lowStockAlerts", event.target.checked)}
            />
          </label>
        </div>
      </Card>
    </section>
  );
}

function ProductForm({ initialValues, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);

  return (
    <GenericForm
      fields={[
        { name: "name", label: "Nombre" },
        { name: "category", label: "Categoria" },
        { name: "cost", label: "Costo", type: "number", step: "0.01" },
        { name: "price", label: "Precio", type: "number", step: "0.01" },
        { name: "stock", label: "Stock actual", type: "number" },
        { name: "minStock", label: "Stock minimo", type: "number" },
        { name: "unit", label: "Unidad" },
        { name: "supplier", label: "Proveedor" },
        { name: "expiry", label: "Vencimiento", type: "date" },
        { name: "notes", label: "Notas", textarea: true, fullWidth: true },
      ]}
      values={formValues}
      onChange={setFormValues}
      onSubmit={() => onSubmit(formValues)}
      onCancel={onCancel}
    />
  );
}

function TaskForm({ initialValues, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);

  return (
    <GenericForm
      fields={[
        { name: "title", label: "Titulo" },
        { name: "priority", label: "Prioridad", options: ["Alta", "Media", "Baja"] },
        { name: "dueDate", label: "Fecha limite", type: "date" },
        { name: "view", label: "Vista", options: ["Hoy", "Semana"] },
      ]}
      values={formValues}
      onChange={setFormValues}
      onSubmit={() => onSubmit(formValues)}
      onCancel={onCancel}
    />
  );
}

function PurchaseForm({ initialValues, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);

  return (
    <GenericForm
      fields={[
        { name: "item", label: "Item" },
        { name: "supplier", label: "Proveedor" },
        { name: "quantity", label: "Cantidad", type: "number" },
        { name: "estimatedCost", label: "Costo estimado", type: "number", step: "0.01" },
        { name: "status", label: "Estado", options: ["pending", "done"] },
        { name: "dueDate", label: "Fecha", type: "date" },
      ]}
      values={formValues}
      onChange={setFormValues}
      onSubmit={() => onSubmit(formValues)}
      onCancel={onCancel}
    />
  );
}

function ExpenseForm({ initialValues, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);

  return (
    <GenericForm
      fields={[
        { name: "name", label: "Concepto" },
        { name: "category", label: "Categoria", options: ["Insumos", "Compras", "Otros"] },
        { name: "amount", label: "Monto", type: "number", step: "0.01" },
        { name: "date", label: "Fecha", type: "date" },
      ]}
      values={formValues}
      onChange={setFormValues}
      onSubmit={() => onSubmit(formValues)}
      onCancel={onCancel}
    />
  );
}

function NoteForm({ initialValues, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);

  return (
    <GenericForm
      fields={[
        { name: "title", label: "Titulo" },
        { name: "body", label: "Contenido", textarea: true, fullWidth: true },
      ]}
      values={formValues}
      onChange={setFormValues}
      onSubmit={() => onSubmit(formValues)}
      onCancel={onCancel}
    />
  );
}

function GenericForm({ fields, values, onChange, onSubmit, onCancel }) {
  const handleValueChange = (field, value) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {fields.map((field) => (
        <label key={field.name} className={field.fullWidth ? "full-width" : ""}>
          {field.label}
          {field.textarea ? (
            <textarea value={values[field.name]} onChange={(event) => handleValueChange(field.name, event.target.value)} />
          ) : field.options ? (
            <select value={values[field.name]} onChange={(event) => handleValueChange(field.name, event.target.value)}>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || "text"}
              step={field.step}
              value={values[field.name]}
              onChange={(event) => handleValueChange(field.name, event.target.value)}
            />
          )}
        </label>
      ))}
      <div className="form-actions full-width">
        <button className="ghost-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button" type="submit">
          Guardar
        </button>
      </div>
    </form>
  );
}

function Card({ title, actionLabel, children }) {
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
        </div>
        {actionLabel ? <span className="badge muted">{actionLabel}</span> : null}
      </div>
      {children}
    </article>
  );
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="card-header">
          <div>
            <h3>{title}</h3>
            <p className="support-text">{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title, text, actionLabel, onAction, compact }) {
  return (
    <div className={`section-header ${compact ? "compact" : ""}`}>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {actionLabel ? (
        <button className="primary-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, detail, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">
        <Icon name={icon} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleBarChart({ items }) {
  const max = Math.max(...items.map((item) => item.amount), 1);

  return (
    <div className="chart-stack">
      {items.map((item) => (
        <div className="chart-row" key={item.category}>
          <div className="chart-labels">
            <strong>{item.category}</strong>
            <span>{formatCurrency(item.amount)}</span>
          </div>
          <div className="chart-track">
            <span className="chart-fill" style={{ width: `${(item.amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskList({ items, onToggle }) {
  return items.length ? (
    <div className="list-stack">
      {items.map((task) => (
        <label className={`task-row ${task.done ? "is-done" : ""}`} key={task.id}>
          <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
          <div>
            <strong>{task.title}</strong>
            <p>
              {task.priority} · {formatDate(task.dueDate)}
            </p>
          </div>
        </label>
      ))}
    </div>
  ) : (
    <EmptyState title="Nada por aqui" message="No hay tareas cargadas para esta vista." />
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="spark" />
      </div>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function Icon({ name }) {
  const icons = {
    home: "M4 10.5 12 4l8 6.5V20h-5.5v-5h-5V20H4z",
    box: "M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z M12 4v16 M4 7.5l8 3.5 8-3.5",
    layers: "M12 4 3.5 8.5 12 13l8.5-4.5z M5.5 12 12 15.5 18.5 12 M5.5 15.5 12 19l6.5-3.5",
    cart: "M5 6h2l1.2 7.2A2 2 0 0 0 10.2 15H17a2 2 0 0 0 1.9-1.4L20 8H8.2 M10 19a1.5 1.5 0 1 0 0 .01 M17 19a1.5 1.5 0 1 0 0 .01",
    chart: "M5 18V9 M12 18V5 M19 18v-7",
    check: "M5 12.5 9.2 16.5 19 7.5",
    calendar: "M7 3v3 M17 3v3 M4 8h16 M5 6h14a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z",
    gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7 3.5-.8-.3a6.9 6.9 0 0 0-.4-1l.5-.7a1 1 0 0 0-.1-1.3l-1.4-1.4a1 1 0 0 0-1.3-.1l-.7.5a6.9 6.9 0 0 0-1-.4L14 4.9A1 1 0 0 0 13 4h-2a1 1 0 0 0-1 .9l-.3.8a6.9 6.9 0 0 0-1 .4L8 5.6a1 1 0 0 0-1.3.1L5.3 7.1a1 1 0 0 0-.1 1.3l.5.7a6.9 6.9 0 0 0-.4 1L4.5 12a1 1 0 0 0 0 2l.8.3a6.9 6.9 0 0 0 .4 1l-.5.7a1 1 0 0 0 .1 1.3l1.4 1.4a1 1 0 0 0 1.3.1l.7-.5a6.9 6.9 0 0 0 1 .4l.3.8a1 1 0 0 0 1 .9h2a1 1 0 0 0 1-.9l.3-.8a6.9 6.9 0 0 0 1-.4l.7.5a1 1 0 0 0 1.3-.1l1.4-1.4a1 1 0 0 0 .1-1.3l-.5-.7a6.9 6.9 0 0 0 .4-1l.8-.3a1 1 0 0 0 0-2Z",
    menu: "M4 7h16 M4 12h16 M4 17h16",
    close: "M6 6l12 12 M18 6 6 18",
    spark: "M12 3 14.8 9.2 21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z",
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name]} />
    </svg>
  );
}

function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export default App;
