# Handoff Para Claude

Proyecto: app web de gestion de facturas por cliente.

Workspace local:
`C:\Users\nacho\OneDrive\Documentos\New project`

Repo correcto para push:
`https://github.com/IgnacioDallape/FacturasTyC.git`

Remote que debe usar para pushear:
`facturastyc`

Branch actual:
`main`

Importante:
- No pushear a `origin`.
- `origin` apunta a otro repo distinto: `https://github.com/IgnacioDallape/nutriapp.git`
- El remoto correcto para este proyecto es `facturastyc`.

## Estado actual

Base reciente del trabajo:
- `8f7b734 Split trips into separate view`

Hay cambios locales sin commitear en:
- `src/App.jsx`
- `src/styles.css`

Esos cambios locales ya avanzan en esta direccion:
- Renombrar la vista a `Viajes no facturados`
- Hacer que la seccion `Viajes` tenga la misma metodologia visual y estructural que `Clientes`
- Cards por cliente
- Cada cliente desplegable
- Cada viaje adentro como fila desplegable compacta

## Objetivo de producto

La app tiene 3 vistas principales:
- `Dashboard`
- `Clientes`
- `Viajes`

### Dashboard
- Dona principal con total sin cobrar en el centro, convertido a USD con dolar fijo de 1100 ARS
- Debajo, resumen por cliente
- Estetica beige / arena / crema / dorado suave

### Clientes
- Cards por cliente, finitas, desplegables
- Cerradas: nombre del cliente, total vencido, badge de estado y flecha
- Total vencido = facturas impagas con 30 dias o mas
- Dentro: resumen y listado de facturas
- Cada factura es desplegable y cerrada muestra:
  - numero de factura
  - fecha
  - monto
- `Agregar factura` ya no vive dentro de cada cliente
- El alta de factura ahora esta arriba, debajo de `Agregar cliente`
- El formulario global de factura tiene selector de empresa/cliente
- Solo se puede facturar a clientes ya creados
- Si el cliente es `Varios`, aparece el campo extra para nombre asociado

### Viajes
- Debe llamarse exactamente `Viajes no facturados`
- Debe tener la misma metodologia que `Clientes`
- Mismo lenguaje visual
- Mismo comportamiento desplegable por cliente
- Mismo criterio de compactacion
- Alta global arriba, tipo bloque plegable, similar a `Agregar factura`

## Lo ultimo que el usuario pidio

Texto literal del pedido actual, ya parcialmente implementado:

`ponele viajes no facturados, sumado a eso, que tenga la misma metodologia y forma y todo que la seccion clientes`

Interpretacion correcta:
- La vista de viajes no debe verse como una tabla/lista distinta
- Debe sentirse hermana de `Clientes`
- Agrupar viajes por cliente
- Mostrar una card por cliente
- Card cerrada compacta
- Al desplegar, ver el detalle de viajes

## Diseno a respetar

- Look administrativo elegante
- Paleta calida: crema, beige, arena, dorado apagado
- Bordes redondeados
- Sombras suaves
- Nada de layouts apretados o que obliguen a scroll horizontal
- Mobile muy importante
- Header minimal:
  - solo `Facturas` centrado
  - debajo nav con `Dashboard`, `Clientes`, `Viajes`

## Sugerencia concreta para terminar bien la vista Viajes

1. Mantener una card por cliente en la vista `Viajes`
2. En la card cerrada mostrar:
   - nombre del cliente
   - total no facturado
   - cantidad de viajes pendientes
3. En la parte desplegada mostrar:
   - resumen corto
   - listado de viajes de ese cliente
4. Cada viaje como item desplegable, compacto
5. En cerrado mostrar:
   - trayecto
   - fecha
   - monto
6. En abierto mostrar:
   - nota
   - nombre asociado si aplica
   - estado
   - acciones

## Verificaciones antes de pushear

Ejecutar:

```powershell
npm run build
git status --short
git remote -v
```

Confirmar:
- que no haya errores de build
- que el remote usado para push sea `facturastyc`
- que no se empuje a `origin`

## Comandos de push esperados

```powershell
git add src/App.jsx src/styles.css public/service-worker.js
git commit -m "Make trips view match client workflow"
git push facturastyc main
```

## Nota final

Si hay cambios extra del usuario mientras trabajas, priorizar:
- no romper mobile
- no reintroducir scroll horizontal
- mantener la coherencia visual entre `Clientes` y `Viajes`
