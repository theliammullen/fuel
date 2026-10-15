// Ground-truth products for the OCR accuracy test. Values are per serving, in label units.
// kcal, fat g, sat g, trans g, chol mg, sodium mg, carbs g, fibre g, sugars g, added g (US), protein g, potassium mg, calcium mg, iron mg, vitD µg (US)
module.exports = [
  { id: 'proteinbar', per: ['1 bar', 60], perFr: '1 barre', kcal: 190, fat: 7, sat: 3, trans: 0, chol: 5, sodium: 200, carbs: 22, fibre: 15, sugars: 1, added: 0, protein: 21, potassium: 150, calcium: 130, iron: 1.8, vitD: 0 },
  { id: 'yogurt', per: ['3/4 cup', 175], perFr: '3/4 tasse', kcal: 140, fat: 0, sat: 0, trans: 0, chol: 10, sodium: 95, carbs: 9, fibre: 0, sugars: 7, added: 0, protein: 20, potassium: 260, calcium: 200, iron: 0, vitD: 2 },
  { id: 'granola', per: ['1/2 cup', 55], perFr: '1/2 tasse', kcal: 250, fat: 9, sat: 1.5, trans: 0, chol: 0, sodium: 120, carbs: 35, fibre: 5, sugars: 12, added: 10, protein: 6, potassium: 220, calcium: 30, iron: 2.2, vitD: 0 },
  { id: 'oatmilk', per: ['1 cup', 250], perFr: '1 tasse', ml: true, kcal: 120, fat: 5, sat: 0.5, trans: 0, chol: 0, sodium: 100, carbs: 16, fibre: 2, sugars: 7, added: 7, protein: 3, potassium: 390, calcium: 350, iron: 0.3, vitD: 2.5 },
  { id: 'peanutbutter', per: ['2 tbsp', 32], perFr: '2 c. à soupe', kcal: 190, fat: 16, sat: 3, trans: 0, chol: 0, sodium: 140, carbs: 7, fibre: 2, sugars: 3, added: 2, protein: 8, potassium: 210, calcium: 15, iron: 0.6, vitD: 0 },
  { id: 'crackers', per: ['20 crackers', 30], perFr: '20 craquelins', kcal: 140, fat: 4.5, sat: 0.4, trans: 0, chol: 0, sodium: 260, carbs: 22, fibre: 1, sugars: 2, added: 2, protein: 3, potassium: 45, calcium: 10, iron: 1.4, vitD: 0 },
  { id: 'tuna', per: ['1/2 can', 85], perFr: '1/2 boîte', kcal: 90, fat: 1, sat: 0.3, trans: 0, chol: 35, sodium: 290, carbs: 0, fibre: 0, sugars: 0, added: 0, protein: 20, potassium: 200, calcium: 10, iron: 0.9, vitD: 1.2 },
  { id: 'cereal', per: ['1 cup', 39], perFr: '1 tasse', kcal: 150, fat: 2, sat: 0.3, trans: 0, chol: 0, sodium: 190, carbs: 33, fibre: 4, sugars: 9, added: 8, protein: 4, potassium: 170, calcium: 100, iron: 6.3, vitD: 0 },
];
