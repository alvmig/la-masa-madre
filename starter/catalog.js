// Catálogo estático del obrador. `price` en euros con dos decimales, tal cual
// se envía a GA4; los cálculos de importes se hacen en céntimos (ver app.js).
export const BRAND = 'La Masa Madre';
export const CURRENCY = 'EUR';

export const PRODUCTS = [
  { item_id: 'MM-HOG-01', item_name: 'Hogaza de masa madre',   item_category: 'Panes',    item_category2: 'Masa madre', price: 5.50,
    blurb: 'Fermentación lenta de 24 horas. Corteza gruesa, miga húmeda. Aguanta cuatro días en el paño.' },
  { item_id: 'MM-CEN-01', item_name: 'Pan de centeno',         item_category: 'Panes',    item_category2: 'Masa madre', price: 4.80,
    blurb: 'Denso y con carácter. Va bien con mantequilla salada y con queso curado.' },
  { item_id: 'MM-ESP-01', item_name: 'Espelta integral',       item_category: 'Panes',    item_category2: 'Integrales', price: 5.20,
    blurb: 'Harina de espelta molida a la piedra. Sabor a nuez, miga suave.' },
  { item_id: 'MM-BAG-01', item_name: 'Baguette tradición',     item_category: 'Panes',    item_category2: 'Clásicos',   price: 1.90,
    blurb: 'Crujiente por fuera, alveolada por dentro. Del día, salen dos hornadas.' },
  { item_id: 'MM-NUE-01', item_name: 'Pan de nueces y pasas',  item_category: 'Panes',    item_category2: 'Especiales', price: 6.20,
    blurb: 'Para el desayuno o con un queso azul. Se acaba pronto, avisados quedáis.' },
  { item_id: 'MM-BRI-01', item_name: 'Brioche de mantequilla', item_category: 'Bollería', item_category2: 'Especiales', price: 7.50,
    blurb: 'Mantequilla de verdad y huevos de la granja de al lado. Los sábados sale a las nueve.' },
];

// Listas de producto: el mismo item puede verse en varias listas y GA4
// atribuye select_item / add_to_cart a la lista de origen.
export const LISTS = {
  catalogo:        { id: 'catalogo',        name: 'Catálogo' },
  destacados_home: { id: 'destacados_home', name: 'Destacados home' },
};

export const FEATURED_IDS = ['MM-HOG-01', 'MM-NUE-01', 'MM-BRI-01'];

export function getProduct(itemId) {
  return PRODUCTS.find((p) => p.item_id === itemId) || null;
}

export function getFeatured() {
  return FEATURED_IDS.map(getProduct);
}
