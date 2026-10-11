# Flujo — tablero Kanban

Tablero Kanban hecho con HTML, CSS y JavaScript, sin librerías ni instalación.

## Estructura

```
flujo/
├── index.html       Estructura: cabecera, métricas, tablero y ventanas
├── css/
│   └── styles.css   Colores, tarjetas, columnas, modo oscuro y móvil
├── js/
│   ├── estado.js    Datos: columnas, tarjetas, reglas WIP, guardado y métricas
│   └── app.js       Pantalla: pintar el tablero, arrastrar, formularios y filtros
└── README.md
```

`estado.js` se carga antes que `app.js`: primero los datos y las reglas, después lo que se ve.

## Cómo usarlo

1. Descomprime el .zip.
2. Abre `index.html` con doble clic.
3. Pulsa **Borrar ejemplos** y crea tus propias tarjetas.

## Funciones

| Función | Cómo se usa |
|---|---|
| Crear tarjeta | Botón **+ Nueva tarjeta** o **+ Añadir tarjeta** en la primera columna |
| Mover | Arrastrar y soltar, flechas ← → de la tarjeta, o flechas del teclado con la tarjeta seleccionada |
| Editar o eliminar | Botón **Editar** o tecla Enter |
| Límites WIP | **Columnas y límites**: nombre y máximo de tarjetas por columna (0 = sin límite) |
| Filtros | Búsqueda por texto, prioridad y persona |
| Copia de seguridad | Copiar el tablero como texto y restaurarlo después |

## Reglas del flujo

- La **primera columna** es la entrada y la **última** cuenta como terminado.
- Una tarjeta se considera **empezada** al llegar a la tercera columna (o a la segunda si hay menos de 4).
- Si una columna está en su límite WIP, el tablero no deja meter más tarjetas en ella.

## Métricas

| Métrica | Qué mide |
|---|---|
| Trabajo en curso | Tarjetas empezadas y sin terminar |
| Terminadas en 7 días | Rendimiento (throughput) de la última semana |
| Lead time medio | Días desde que se crea una tarjeta hasta que se termina |
| Cycle time medio | Días desde que se empieza hasta que se termina |

## Datos

Todo se guarda en el `localStorage` del navegador: se mantiene al cerrar la página, pero solo en ese navegador y ese equipo. Usa **Copia de seguridad** de vez en cuando.
