import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nutri-atelier-state-v2";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "products", label: "Productos y stock", icon: "box" },
  { id: "purchases", label: "Compras", icon: "cart" },
  { id: "costs", label: "Costos", icon: "chart" },
  { id: "tasks", label: "Tareas", icon: "check" },
  { id: "settings", label: "Configuracion", icon: "gear" },
];

const initialState = {
  profile: {
    studioName: "Nutri Atelier",
    owner: "Valentina Rossi",
    focus: "Nutricion consciente y productos funcionales",
  },
  products: [
    {
      id: "p1",
      name: "Granola premium",
      category: "Despensa saludable",
      price: 8900,
      stock: 14,
      minStock: 10,
      unit: "packs",
      supplier: "Natural Fields",
      notes: "Blend con frutos secos y semillas.",
    },
    {
      id: "p2",
      name: "Mix proteico cacao",
      category: "Suplementos",
      price: 22000,
      stock: 6,
      minStock: 8,
      unit: "frascos",
      supplier: "Bio Source",
      notes: "Producto con demanda alta.",
    },
    {
      id: "p3",
      name: "Harina de almendras",
      category: "Insumos",
      price: 12500,
      stock: 18,
      minStock: 12,
      unit: "kg",
      supplier: "Alma Organica",
      notes: "Base para recetas low carb.",
    },
    {
      id: "p4",
      name: "Kombucha citrus",
      category: "Bebidas",
      price: 5800,
      stock: 9,
      minStock: 9,
      unit: "botellas",
      supplier: "Fermenta Lab",
      notes: "Ideal para combos semanales.",
    },
  ],
  purchases: [
    { id: "buy1", item: "Proteina vegetal vainilla", quantity: 2, place: "Bio Source", price: 46000, done: false },
    { id: "buy2", item: "Etiquetas kraft", quantity: 100, place: "Casa Grafica", price: 26000, done: true },
  ],
  costs: [
    { id: "c1", name: "Alquiler del espacio", type: "fixed", amount: 180000, date: "2026-05-01" },
    { id: "c2", name: "Internet y celular", type: "fixed", amount: 42000, date: "2026-05-02" },
    { id: "c3", name: "Compra de semillas", type: "variable", amount: 84000, date: "2026-05-03" },
    { id: "c4", name: "Envases de vidrio", type: "variable", amount: 47000, date: "2026-05-08" },
  ],
  tasks: [
    { id: "t1", title: "Revisar stock de suplementos", priority: "Alta", dueDate: "2026-05-17", done: false, view: "Hoy" },
    { id: "t2", title: "Actualizar precios del invierno", priority: "Media", dueDate: "2026-05-19", done: false, view: "Semana" },
    { id: "t3", title: "Preparar pedidos de suscripcion", priority: "Alta", dueDate: "2026-05-18", done: true, view: "Hoy" },
    { id: "t4", title: "Comprar insumos secos", priority: "Baja", dueDate: "2026-05-21", done: false, view: "Semana" },
  ],
  settings: {
    currency: "ARS",
    lowStockAlerts: true,
  },
};

const blankProduct = {
  name: "",
  category: "",
  price: "",
  stock: 0,
  minStock: 1,
  unit: "unidades",
  supplier: "",
  notes: "",
};

const blankPurchase = {
  item: "",
  quantity: 1,
  place: "",
  price: "",
  done: false,
};

const blankCost = {
  name: "",
  type: "fixed",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
};

const blankTask = {
  title: "",
  priority: "Media",
  dueDate: new Date().toISOString().slice(0, 10),
  done: false,
  view: "Semana",
};

function App() {
  const [appState, setAppState] = usePersistedState(STORAGE_KEY, initialState);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);

  const products = appState.products || [];
  const purchases = appState.purchases || [];
  const costs = appState.costs || appState.expenses || [];
  const tasks = appState.tasks || [];

  const lowStockProducts = useMemo(
    () => products.filter((product) => Number(product.stock) <= Number(product.minStock)),
    [products],
  );

  const pendingPurchases = useMemo(
    () => purchases.filter((purchase) => !purchase.done),
    [purchases],
  );

  const completedTasks = useMemo(() => tasks.filter((task) => task.done), [tasks]);
  const openTasks = useMemo(() => tasks.filter((task) => !task.done), [tasks]);

  const fixedCosts = useMemo(() => costs.filter((cost) => cost.type === "fixed"), [costs]);
  const variableCosts = useMemo(() => costs.filter((cost) => cost.type !== "fixed"), [costs]);
  const fixedTotal = useMemo(() => sumBy(fixedCosts, "amount"), [fixedCosts]);
  const variableTotal = useMemo(() => sumBy(variableCosts, "amount"), [variableCosts]);
  const monthlyCosts = fixedTotal + variableTotal;
  const stockUnits = useMemo(() => products.reduce((total, product) => total + Number(product.stock), 0), [products]);
  const stockValue = useMemo(
    () => products.reduce((total, product) => total + Number(product.price || 0) * Number(product.stock || 0), 0),
    [products],
  );

  const updateState = (key, value) => {
    setAppState((current) => ({ ...current, [key]: value }));
  };

  const updateProfile = (field, value) => {
    setAppState((current) => ({ ...current, profile: { ...current.profile, [field]: value } }));
  };

  const addProduct = (formValues) => {
    const product = normalizeProduct(formValues);
    if (!product.name.trim()) return;
    updateState("products", [{ id: crypto.randomUUID(), ...product }, ...products]);
  };

  const updateProduct = (productId, updates) => {
    updateState(
      "products",
      products.map((product) =>
        product.id === productId ? { ...product, ...normalizeProduct({ ...product, ...updates }) } : product,
      ),
    );
  };

  const deleteProduct = (productId) => {
    updateState("products", products.filter((product) => product.id !== productId));
  };

  const adjustStock = (productId, amount) => {
    updateState(
      "products",
      products.map((product) =>
        product.id === productId
          ? { ...product, stock: Math.max(0, Number(product.stock || 0) + amount) }
          : product,
      ),
    );
  };

  const setProductStock = (productId, value) => {
    const normalizedValue = value.replace(",", ".");

    updateState(
      "products",
      products.map((product) =>
        product.id === productId ? { ...product, stock: normalizedValue === "" ? "" : Math.max(0, Number(normalizedValue)) } : product,
      ),
    );
  };

  const addPurchase = (formValues) => {
    if (!formValues.item.trim()) return;
    updateState("purchases", [
      {
        id: crypto.randomUUID(),
        item: formValues.item,
        quantity: Number(formValues.quantity || 1),
        place: formValues.place,
        price: Number(formValues.price || 0),
        done: false,
      },
      ...purchases,
    ]);
  };

  const togglePurchase = (purchaseId) => {
    updateState(
      "purchases",
      purchases.map((purchase) => (purchase.id === purchaseId ? { ...purchase, done: !purchase.done } : purchase)),
    );
  };

  const deletePurchase = (purchaseId) => {
    updateState("purchases", purchases.filter((purchase) => purchase.id !== purchaseId));
  };

  const deleteDonePurchases = () => {
    updateState("purchases", purchases.filter((purchase) => !purchase.done));
  };

  const addCost = (formValues) => {
    if (!formValues.name.trim()) return;
    updateState("costs", [
      {
        id: crypto.randomUUID(),
        name: formValues.name,
        type: formValues.type,
        amount: Number(formValues.amount || 0),
        date: formValues.date,
      },
      ...costs,
    ]);
    setShowCostModal(false);
  };

  const deleteCost = (costId) => {
    updateState("costs", costs.filter((cost) => cost.id !== costId));
  };

  const addTask = (formValues) => {
    if (!formValues.title.trim()) return;
    updateState("tasks", [{ id: crypto.randomUUID(), ...formValues }, ...tasks]);
    setShowTaskModal(false);
  };

  const toggleTask = (taskId) => {
    updateState("tasks", tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)));
  };

  const deleteCompletedTasks = () => {
    updateState("tasks", tasks.filter((task) => !task.done));
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
            <p className="eyebrow">Gestion simple</p>
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
          <span className="badge muted">Pesos argentinos</span>
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
            products={products}
            lowStockProducts={lowStockProducts}
            pendingPurchases={pendingPurchases}
            openTasks={openTasks}
            monthlyCosts={monthlyCosts}
            stockValue={stockValue}
            fixedTotal={fixedTotal}
            variableTotal={variableTotal}
          />
        )}

        {activeSection === "products" && (
          <ProductsStockView
            products={products}
            stockUnits={stockUnits}
            lowStockProducts={lowStockProducts}
            onAdd={addProduct}
            onEdit={setEditingProduct}
            onDelete={deleteProduct}
            onStockChange={adjustStock}
            onStockSet={setProductStock}
          />
        )}

        {activeSection === "purchases" && (
          <PurchasesView
            purchases={purchases}
            onAdd={addPurchase}
            onToggle={togglePurchase}
            onDelete={deletePurchase}
            onDeleteDone={deleteDonePurchases}
          />
        )}

        {activeSection === "costs" && (
          <CostsView
            fixedCosts={fixedCosts}
            variableCosts={variableCosts}
            fixedTotal={fixedTotal}
            variableTotal={variableTotal}
            onCreate={() => setShowCostModal(true)}
            onDelete={deleteCost}
          />
        )}

        {activeSection === "tasks" && (
          <TasksView
            tasks={tasks}
            completedTasks={completedTasks}
            onCreate={() => setShowTaskModal(true)}
            onToggle={toggleTask}
            onDeleteCompleted={deleteCompletedTasks}
          />
        )}

        {activeSection === "settings" && (
          <SettingsView settings={appState.settings} profile={appState.profile} onSave={saveSettings} onProfileChange={updateProfile} />
        )}
      </main>

      {editingProduct && (
        <Modal title="Editar producto" subtitle="Actualiza los datos principales del producto." onClose={() => setEditingProduct(null)}>
          <ProductForm
            initialValues={editingProduct}
            onSubmit={(values) => {
              updateProduct(editingProduct.id, values);
              setEditingProduct(null);
            }}
            onCancel={() => setEditingProduct(null)}
          />
        </Modal>
      )}

      {showTaskModal && (
        <Modal title="Nueva tarea" subtitle="Carga una accion simple para hoy o para la semana." onClose={() => setShowTaskModal(false)}>
          <TaskForm initialValues={blankTask} onSubmit={addTask} onCancel={() => setShowTaskModal(false)} />
        </Modal>
      )}

      {showCostModal && (
        <Modal title="Nuevo costo" subtitle="Separalo como fijo o variable para leer el negocio mas claro." onClose={() => setShowCostModal(false)}>
          <CostForm initialValues={blankCost} onSubmit={addCost} onCancel={() => setShowCostModal(false)} />
        </Modal>
      )}
    </div>
  );
}

const sectionTitles = {
  dashboard: "Dashboard",
  products: "Productos y stock",
  purchases: "Compras",
  costs: "Costos",
  tasks: "Tareas",
  settings: "Configuracion",
};

const sectionDescriptions = {
  dashboard: "Resumen rapido del negocio, stock, compras, tareas y costos del mes.",
  products: "Alta rapida, edicion simple y control directo de cantidades.",
  purchases: "Lista de compras tipo super: producto, cantidad, precio opcional y lugar de compra.",
  costs: "Costos fijos y variables separados para entender mejor los numeros.",
  tasks: "Tareas del dia y la semana con opcion de limpiar las realizadas.",
  settings: "Preferencias basicas del negocio.",
};

function TopBar({ title, description, onMenuClick }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-button mobile-only" onClick={onMenuClick} aria-label="Abrir menu">
          <Icon name="menu" />
        </button>
        <div>
          <p className="eyebrow">Panel principal</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
    </header>
  );
}

function DashboardView({
  products,
  lowStockProducts,
  pendingPurchases,
  openTasks,
  monthlyCosts,
  stockValue,
  fixedTotal,
  variableTotal,
}) {
  return (
    <section className="view-grid">
      <div className="stats-grid">
        <StatCard label="Productos" value={products.length} detail={`${lowStockProducts.length} con stock bajo`} icon="box" />
        <StatCard label="Compras pendientes" value={pendingPurchases.length} detail="Items por comprar" icon="cart" />
        <StatCard label="Tareas abiertas" value={openTasks.length} detail="Por hacer" icon="check" />
        <StatCard label="Costos del mes" value={formatCurrency(monthlyCosts)} detail="Fijos + variables" icon="chart" />
      </div>

      <section className="summary-band">
        <div>
          <span className="badge">Resumen</span>
          <h3>El negocio, claro y a mano</h3>
          <p>Stock bajo, compras pendientes, tareas y costos visibles sin vueltas.</p>
        </div>
        <div className="hero-metrics">
          <MiniMetric label="Valor en stock" value={formatCurrency(stockValue)} />
          <MiniMetric label="Costos fijos" value={formatCurrency(fixedTotal)} />
          <MiniMetric label="Costos variables" value={formatCurrency(variableTotal)} />
        </div>
      </section>

      <Card title="Stock bajo" actionLabel="Reponer">
        {lowStockProducts.length ? (
          <div className="list-stack">
            {lowStockProducts.map((product) => (
              <div className="list-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <p>
                    {formatAmount(product.stock)} {product.unit} disponibles, minimo {formatAmount(product.minStock)}
                  </p>
                </div>
                <span className="status-pill warning">Bajo</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Stock en orden" message="No hay productos por debajo del minimo." />
        )}
      </Card>

      <Card title="Proximas compras" actionLabel="Lista">
        {pendingPurchases.length ? (
          <div className="list-stack">
            {pendingPurchases.slice(0, 5).map((purchase) => (
              <div className="list-row" key={purchase.id}>
                <div>
                  <strong>{purchase.item}</strong>
                  <p>
                    Cantidad {purchase.quantity}
                    {purchase.place ? ` - ${purchase.place}` : ""}
                  </p>
                </div>
                {purchase.price ? <strong>{formatCurrency(purchase.price)}</strong> : <span className="status-pill">Sin precio</span>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Lista vacia" message="No hay compras pendientes." />
        )}
      </Card>
    </section>
  );
}

function ProductsStockView({ products, stockUnits, lowStockProducts, onAdd, onEdit, onDelete, onStockChange, onStockSet }) {
  const [formValues, setFormValues] = useState(blankProduct);

  const submitProduct = (event) => {
    event.preventDefault();
    onAdd(formValues);
    setFormValues(blankProduct);
  };

  return (
    <section className="view-stack">
      <div className="stats-grid compact-stats">
        <StatCard label="Productos cargados" value={products.length} detail="En tu inventario" icon="box" />
        <StatCard label="Unidades totales" value={formatAmount(stockUnits)} detail="Stock disponible" icon="layers" />
        <StatCard label="Stock bajo" value={lowStockProducts.length} detail="Necesitan atencion" icon="spark" />
      </div>

      <form className="quick-add-form" onSubmit={submitProduct}>
        <label>
          Producto
          <input
            value={formValues.name}
            onChange={(event) => setFormValues({ ...formValues, name: event.target.value })}
            placeholder="Ej: Almendras"
          />
        </label>
        <label>
          Stock
          <input
            type="number"
            min="0"
            step="0.01"
            value={formValues.stock}
            onChange={(event) => setFormValues({ ...formValues, stock: event.target.value })}
          />
        </label>
        <label>
          Minimo
          <input
            type="number"
            min="0"
            step="0.01"
            value={formValues.minStock}
            onChange={(event) => setFormValues({ ...formValues, minStock: event.target.value })}
          />
        </label>
        <label>
          Precio
          <input
            type="number"
            min="0"
            value={formValues.price}
            onChange={(event) => setFormValues({ ...formValues, price: event.target.value })}
            placeholder="Opcional"
          />
        </label>
        <label>
          Proveedor
          <input
            value={formValues.supplier}
            onChange={(event) => setFormValues({ ...formValues, supplier: event.target.value })}
            placeholder="Opcional"
          />
        </label>
        <button className="primary-button" type="submit">
          Agregar
        </button>
      </form>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Minimo</th>
              <th>Precio</th>
              <th>Proveedor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                  <span>{product.category || product.unit}</span>
                </td>
                <td>
                  <div className="stock-stepper">
                    <button className="icon-button" onClick={() => onStockChange(product.id, -1)} aria-label={`Restar stock de ${product.name}`}>
                      <Icon name="minus" />
                    </button>
                    <input
                      className="stock-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={product.stock}
                      onChange={(event) => onStockSet(product.id, event.target.value)}
                      aria-label={`Stock de ${product.name}`}
                    />
                    <button className="icon-button" onClick={() => onStockChange(product.id, 1)} aria-label={`Sumar stock de ${product.name}`}>
                      <Icon name="plus" />
                    </button>
                  </div>
                </td>
                <td>
                  <span className={`status-pill ${Number(product.stock) <= Number(product.minStock) ? "warning" : "ok"}`}>
                    {formatAmount(product.minStock)}
                  </span>
                </td>
                <td>{product.price ? formatCurrency(product.price) : "Sin precio"}</td>
                <td>{product.supplier || "Sin proveedor"}</td>
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

function PurchasesView({ purchases, onAdd, onToggle, onDelete, onDeleteDone }) {
  const [formValues, setFormValues] = useState(blankPurchase);
  const pending = purchases.filter((purchase) => !purchase.done);
  const done = purchases.filter((purchase) => purchase.done);

  const submitPurchase = (event) => {
    event.preventDefault();
    onAdd(formValues);
    setFormValues(blankPurchase);
  };

  return (
    <section className="view-stack">
      <form className="quick-add-form purchases-form" onSubmit={submitPurchase}>
        <label>
          Producto
          <input
            value={formValues.item}
            onChange={(event) => setFormValues({ ...formValues, item: event.target.value })}
            placeholder="Ej: avena, frascos, etiquetas"
          />
        </label>
        <label>
          Cantidad
          <input
            type="number"
            min="1"
            value={formValues.quantity}
            onChange={(event) => setFormValues({ ...formValues, quantity: event.target.value })}
          />
        </label>
        <label>
          Precio
          <input
            type="number"
            min="0"
            value={formValues.price}
            onChange={(event) => setFormValues({ ...formValues, price: event.target.value })}
            placeholder="Opcional"
          />
        </label>
        <label>
          Donde
          <input
            value={formValues.place}
            onChange={(event) => setFormValues({ ...formValues, place: event.target.value })}
            placeholder="Opcional"
          />
        </label>
        <button className="primary-button" type="submit">
          Agregar
        </button>
      </form>

      <Card title="Para comprar" actionLabel={`${pending.length} pendientes`}>
        <PurchaseList items={pending} onToggle={onToggle} onDelete={onDelete} />
      </Card>

      <Card title="Comprado" actionLabel={`${done.length} realizados`}>
        <div className="card-toolbar">
          <button className="ghost-button danger" onClick={onDeleteDone} disabled={!done.length}>
            Eliminar comprados
          </button>
        </div>
        <PurchaseList items={done} onToggle={onToggle} onDelete={onDelete} />
      </Card>
    </section>
  );
}

function PurchaseList({ items, onToggle, onDelete }) {
  if (!items.length) {
    return <EmptyState title="Sin items" message="La lista esta vacia." />;
  }

  return (
    <div className="list-stack">
      {items.map((purchase) => (
        <div className={`list-row ${purchase.done ? "is-muted" : ""}`} key={purchase.id}>
          <label className="check-line">
            <input type="checkbox" checked={purchase.done} onChange={() => onToggle(purchase.id)} />
            <div>
              <strong>{purchase.item}</strong>
              <p>
                Cantidad {purchase.quantity}
                {purchase.place ? ` - ${purchase.place}` : ""}
              </p>
            </div>
          </label>
          <div className="list-meta">
            {purchase.price ? <strong>{formatCurrency(purchase.price)}</strong> : <small>Sin precio</small>}
            <button className="ghost-button danger" onClick={() => onDelete(purchase.id)}>
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CostsView({ fixedCosts, variableCosts, fixedTotal, variableTotal, onCreate, onDelete }) {
  return (
    <section className="view-grid">
      <div className="stats-grid">
        <StatCard label="Costos fijos" value={formatCurrency(fixedTotal)} detail="Se repiten cada mes" icon="chart" />
        <StatCard label="Costos variables" value={formatCurrency(variableTotal)} detail="Cambian con la actividad" icon="layers" />
        <StatCard label="Total" value={formatCurrency(fixedTotal + variableTotal)} detail="Fijos + variables" icon="spark" />
      </div>

      <div className="section-toolbar">
        <button className="primary-button" onClick={onCreate}>
          Agregar costo
        </button>
      </div>

      <Card title="Costos fijos" actionLabel={`${fixedCosts.length} registros`}>
        <CostList items={fixedCosts} onDelete={onDelete} />
      </Card>

      <Card title="Costos variables" actionLabel={`${variableCosts.length} registros`}>
        <CostList items={variableCosts} onDelete={onDelete} />
      </Card>
    </section>
  );
}

function CostList({ items, onDelete }) {
  if (!items.length) {
    return <EmptyState title="Sin costos" message="Todavia no hay registros en esta categoria." />;
  }

  return (
    <div className="list-stack">
      {items.map((cost) => (
        <div className="list-row" key={cost.id}>
          <div>
            <strong>{cost.name}</strong>
            <p>{formatDate(cost.date)}</p>
          </div>
          <div className="list-meta">
            <strong>{formatCurrency(cost.amount)}</strong>
            <button className="ghost-button danger" onClick={() => onDelete(cost.id)}>
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksView({ tasks, completedTasks, onCreate, onToggle, onDeleteCompleted }) {
  const today = tasks.filter((task) => task.view === "Hoy");
  const week = tasks.filter((task) => task.view === "Semana");

  return (
    <section className="view-grid">
      <div className="section-toolbar">
        <button className="primary-button" onClick={onCreate}>
          Nueva tarea
        </button>
        <button className="ghost-button danger" onClick={onDeleteCompleted} disabled={!completedTasks.length}>
          Eliminar realizadas
        </button>
      </div>

      <Card title="Tareas de hoy" actionLabel="Foco">
        <TaskList items={today} onToggle={onToggle} />
      </Card>

      <Card title="Tareas de la semana" actionLabel="Plan">
        <TaskList items={week} onToggle={onToggle} />
      </Card>
    </section>
  );
}

function SettingsView({ settings, profile, onSave, onProfileChange }) {
  return (
    <section className="view-grid">
      <Card title="Preferencias" actionLabel="Basico">
        <div className="settings-stack">
          <label>
            Nombre del emprendimiento
            <input value={profile.studioName} onChange={(event) => onProfileChange("studioName", event.target.value)} />
          </label>
          <label>
            Moneda
            <input value="Pesos argentinos (ARS)" readOnly />
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
  const [formValues, setFormValues] = useState({ ...blankProduct, ...initialValues });

  return (
    <GenericForm
      fields={[
        { name: "name", label: "Nombre" },
        { name: "category", label: "Categoria" },
        { name: "stock", label: "Stock", type: "number", step: "0.01" },
        { name: "minStock", label: "Stock minimo", type: "number", step: "0.01" },
        { name: "price", label: "Precio", type: "number", step: "1" },
        { name: "unit", label: "Unidad" },
        { name: "supplier", label: "Proveedor" },
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

function CostForm({ initialValues, onSubmit, onCancel }) {
  const [formValues, setFormValues] = useState(initialValues);

  return (
    <GenericForm
      fields={[
        { name: "name", label: "Concepto" },
        { name: "type", label: "Tipo", options: ["fixed", "variable"] },
        { name: "amount", label: "Monto", type: "number" },
        { name: "date", label: "Fecha", type: "date" },
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
            <textarea value={values[field.name] || ""} onChange={(event) => handleValueChange(field.name, event.target.value)} />
          ) : field.options ? (
            <select value={values[field.name]} onChange={(event) => handleValueChange(field.name, event.target.value)}>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option === "fixed" ? "Fijo" : option === "variable" ? "Variable" : option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type || "text"}
              step={field.step}
              value={values[field.name] ?? ""}
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
        <h3>{title}</h3>
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
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
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

function TaskList({ items, onToggle }) {
  if (!items.length) {
    return <EmptyState title="Sin tareas" message="No hay tareas en esta vista." />;
  }

  return (
    <div className="list-stack">
      {items.map((task) => (
        <label className={`task-row ${task.done ? "is-done" : ""}`} key={task.id}>
          <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
          <div>
            <strong>{task.title}</strong>
            <p>
              {task.priority} - {formatDate(task.dueDate)}
            </p>
          </div>
        </label>
      ))}
    </div>
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
    gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7 3.5-.8-.3a6.9 6.9 0 0 0-.4-1l.5-.7a1 1 0 0 0-.1-1.3l-1.4-1.4a1 1 0 0 0-1.3-.1l-.7.5a6.9 6.9 0 0 0-1-.4L14 4.9A1 1 0 0 0 13 4h-2a1 1 0 0 0-1 .9l-.3.8a6.9 6.9 0 0 0-1 .4L8 5.6a1 1 0 0 0-1.3.1L5.3 7.1a1 1 0 0 0-.1 1.3l.5.7a6.9 6.9 0 0 0-.4 1L4.5 12a1 1 0 0 0 0 2l.8.3a6.9 6.9 0 0 0 .4 1l-.5.7a1 1 0 0 0 .1 1.3l1.4 1.4a1 1 0 0 0 1.3.1l.7-.5a6.9 6.9 0 0 0 1 .4l.3.8a1 1 0 0 0 1 .9h2a1 1 0 0 0 1-.9l.3-.8a6.9 6.9 0 0 0 1-.4l.7.5a1 1 0 0 0 1.3-.1l1.4-1.4a1 1 0 0 0 .1-1.3l-.5-.7a6.9 6.9 0 0 0 .4-1l.8-.3a1 1 0 0 0 0-2Z",
    menu: "M4 7h16 M4 12h16 M4 17h16",
    close: "M6 6l12 12 M18 6 6 18",
    spark: "M12 3 14.8 9.2 21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z",
    plus: "M12 5v14 M5 12h14",
    minus: "M5 12h14",
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
    return storedValue ? { ...defaultValue, ...JSON.parse(storedValue) } : defaultValue;
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

function normalizeProduct(product) {
  return {
    name: product.name || "",
    category: product.category || "",
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    minStock: Number(product.minStock || 0),
    unit: product.unit || "unidades",
    supplier: product.supplier || "",
    notes: product.notes || "",
  };
}

function sumBy(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function formatAmount(value) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export default App;
