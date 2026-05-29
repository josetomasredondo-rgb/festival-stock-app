// Local data store — replaces base44 backend
// All data is saved to localStorage so it persists between sessions

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function getCollection(name) {
  try {
    const raw = localStorage.getItem(`fsa_${name}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCollection(name, data) {
  localStorage.setItem(`fsa_${name}`, JSON.stringify(data));
}

function createEntity(collectionName) {
  return {
    list: (sortField, limit) => {
      let items = getCollection(collectionName);
      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items = [...items].sort((a, b) => {
          const va = a[field] || '';
          const vb = b[field] || '';
          return desc ? vb.localeCompare(String(va)) : String(va).localeCompare(String(vb));
        });
      }
      if (limit) items = items.slice(0, limit);
      return Promise.resolve(items);
    },
    get: (id) => {
      const items = getCollection(collectionName);
      const item = items.find(i => i.id === id);
      return Promise.resolve(item || null);
    },
    create: (data) => {
      const items = getCollection(collectionName);
      const newItem = {
        ...data,
        id: generateId(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      items.unshift(newItem);
      saveCollection(collectionName, items);
      return Promise.resolve(newItem);
    },
    update: (id, data) => {
      const items = getCollection(collectionName);
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return Promise.reject(new Error('Not found'));
      items[idx] = { ...items[idx], ...data, updated_date: new Date().toISOString() };
      saveCollection(collectionName, items);
      return Promise.resolve(items[idx]);
    },
    delete: (id) => {
      const items = getCollection(collectionName);
      const filtered = items.filter(i => i.id !== id);
      saveCollection(collectionName, filtered);
      return Promise.resolve(true);
    },
    filter: (query) => {
      const items = getCollection(collectionName);
      return Promise.resolve(items.filter(item => {
        return Object.entries(query).every(([k, v]) => item[k] === v);
      }));
    }
  };
}

export const db = {
  Bar: createEntity('bars'),
  Product: createEntity('products'),
  StockReport: createEntity('stockReports'),
  OfferedItems: createEntity('offeredItems'),
  POSSales: createEntity('posSales'),
  ProductPrice: createEntity('productPrices'),
  FestivalSettings: createEntity('festivalSettings'),
};

export default db;
