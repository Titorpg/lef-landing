# LEF — Learn English Fluently
## Guía de identidad de marca (para desarrollo de la landing)

Academia de inglés online. Posicionamiento: **seria, estructurada, elegante** — nunca informal ni "curso rápido". La marca comunica rigor académico antes que entretenimiento.

Referencia visual completa (con más contexto y ejemplos): `reference-brand-guide.html` y `reference-handbook.html` en esta misma carpeta. Ábrelos en el navegador para ver el sistema aplicado.

---

## 1. Esencia de marca

- **Seriedad** — cada pieza se percibe como material académico, no publicidad casual.
- **Compromiso** — refleja el modelo LEF: progreso continuo, ciclos estructurados, acompañamiento real.
- **Elegancia** — nace de la contención (espacio en blanco, tipografía contundente), no del adorno.

Frase ancla de marca: *"Aprender inglés va más allá de memorizar reglas. En LEF, el idioma se usa en la vida real, desde el primer día."*

Claim de cierre: **Structured Learning. Real Communication. Continuous Growth.**

---

## 2. Logotipo

Archivos en `assets/`:
- `logo-horizontal.png` — versión principal (isotipo + wordmark), fondo transparente, negro.
- `logo-isotype.png` — solo el símbolo (letras LEF + globo de diálogo), fondo transparente, negro.

**Reglas:**
- Sobre fondos claros: usar tal cual (negro).
- Sobre fondos oscuros (Tinta `#101010`): invertir a blanco — en CSS, `filter: invert(1)` funciona bien porque son PNG transparentes.
- Nunca a color, nunca con sombras, degradados ni contornos añadidos.
- Área de respeto: espacio libre alrededor equivalente a la altura de la letra "E" del logo. Nada lo invade.
- Tamaño mínimo: horizontal no menor a 120px de ancho en pantalla; isotipo no menor a 32px.
- No estirar ni distorsionar proporciones.

---

## 3. Color — escala de grises + acento azul

La paleta principal es monocromática. El azul es una **combinación alternativa elegible** para dar variabilidad, no un color secundario permanente.

### Escala principal (usar en este orden de prioridad)
| Nombre    | Hex       | Uso |
|-----------|-----------|-----|
| Tinta     | `#101010` | Texto principal, fondos oscuros, logo |
| Carbón    | `#262626` | Bloques oscuros secundarios |
| Grafito   | `#4D4D4D` | Texto secundario, subtítulos |
| Plata     | `#8C8C8C` | Detalles, metadatos, números de sección |
| Niebla    | `#E7E7E4` | Líneas, separadores, bordes |
| Papel     | `#FAFAF8` | Fondo principal del sitio |

**Proporción de uso:** ~70% Papel/Niebla (el vacío es parte del diseño), ~25% Tinta/Carbón (titulares y énfasis), ~5% Grafito/Plata (apoyo).

### Acento azul (opcional, para variabilidad)
| Nombre       | Hex       | Uso |
|--------------|-----------|-----|
| Azul LEF     | `#2E4E9E` | Resaltes puntuales, trazos, íconos, detalles gráficos, CTAs si se desea diferenciar |
| Azul Niebla  | `#C9D6EC` | Fondos suaves de secciones secundarias, subrayados |

**Restricción fija:** el azul **nunca** se aplica al logo ni a los títulos principales (H1/H2 de cada sección) — esos siempre van en Tinta o Papel. El azul vive en acentos secundarios: un botón, un ícono, una franja de fondo, un dato destacado.

---

## 4. Tipografía

Ambas son gratuitas vía Google Fonts:

- **Display / titulares:** `Archivo Black` — siempre en mayúsculas, uso moderado (solo títulos y momentos de énfasis). Google Fonts: `family=Archivo+Black`
- **Cuerpo y UI:** `Jost` — pesos 300 (cuerpo), 500/600 (labels y subtítulos). Google Fonts: `family=Jost:ital,wght@0,300;0,400;0,500;0,600;1,300`

**Escala de referencia (desktop):**
- H1 / hero: 56–160px, Archivo Black, mayúsculas
- H2 / título de sección: 34–68px, Archivo Black, mayúsculas
- Subtítulo: 22–32px, Jost 600
- Cuerpo: 17–24px, Jost 300, line-height 1.6–1.75
- Labels / eyebrows: 11–14px, Jost 500, letter-spacing .28–.32em, mayúsculas

No usar negrita del cuerpo para énfasis largo; para eso está Archivo Black en dosis cortas.

---

## 5. Tono de voz

**LEF sí es:** preciso, sereno, cercano (trata al estudiante como adulto capaz), directo.
**LEF no es:** informal (nada de jerga juvenil ni exceso de emojis), agresivo (sin "¡ÚLTIMOS CUPOS!"), genérico ("inglés fácil y rápido"), frío.

Ejemplo:
- ❌ "¡¡Aprende inglés YA!! 🔥🚀 Súper promo, cupos limitados"
- ✅ "Habla inglés desde la primera clase. Método estructurado, progreso medible."

---

## 6. Principios de layout (del sistema ya construido)

- Fondo por defecto: Papel (`#FAFAF8`), nunca blanco puro.
- Secciones separadas por líneas de 1px en Niebla, no por sombras ni tarjetas flotantes.
- Números de capítulo/sección en Archivo Black con `-webkit-text-stroke` (solo contorno, sin relleno) en Plata — recurso de marca para enumerar secciones.
- Fotografías: pueden ir a color (así se decidió para el handbook final). Bordes de 1px en Niebla alrededor de cada imagen.
- Evitar espacios vacíos grandes: el contenido debe sentirse denso pero ordenado, no minimalista al punto de verse vacío. Tipografía grande, padding de sección moderado (60–90px), no excesivo.
- Fondo oscuro (Tinta) se reserva para: portada/hero, cierre/CTA final, y bloques de énfasis puntuales (ej. tarjeta de "examen" en el handbook). El resto de la página es clara.

---

## 7. Assets incluidos en `/assets`

| Archivo | Descripción | Uso sugerido |
|---|---|---|
| `logo-horizontal.png` | Logo completo, fondo transparente | Header, footer, documentos |
| `logo-isotype.png` | Solo símbolo LEF | Favicon, avatar, watermark, loading spinner |
| `icon-checklist.png` | Ícono lista + lápiz (línea negra) | Sección de evaluación/progreso |
| `icon-handshake.png` | Ícono apretón de manos con check | Sección de compromiso/valores |
| `photo-live-class.jpg` | Foto real de clase en videollamada | Hero o sección "qué es LEF" |
| `photo-materials.jpg` | Foto real de materiales de estudio | Sección "qué ofrecemos" |

---

## 8. Fuentes de contexto adicionales

- `reference-brand-guide.html` — el manual de marca completo (abrir en navegador).
- `reference-handbook.html` — el Academic Handbook ya rediseñado con este sistema; es el mejor ejemplo de "cómo se ve la marca aplicada" y puede usarse como referencia directa de estilo para la landing.
- `LEF_CONTENT.md` — toda la información real del programa (qué es LEF, metodología, oferta, evaluación, compromiso del estudiante) para redactar el copy de la landing sin inventar datos.
