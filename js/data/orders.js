export const orders = [
  {
    id: "ORD-001",
    userId: 1,
    date: "2026-09-01T10:00:00Z",
    status: "completed", // pending, processing, shipping, completed, cancelled
    total: 320000,
    items: [
      { productId: 1, quantity: 2, price: 120000 },
      { productId: 2, quantity: 1, price: 80000 }
    ],
    shippingAddress: "123 Đường Số 1, Quận 1, TP. Hồ Chí Minh",
    paymentMethod: "COD"
  },
  {
    id: "ORD-002",
    userId: 1,
    date: "2026-09-08T15:30:00Z",
    status: "shipping",
    total: 105000,
    items: [
      { productId: 7, quantity: 1, price: 105000 }
    ],
    shippingAddress: "123 Đường Số 1, Quận 1, TP. Hồ Chí Minh",
    paymentMethod: "Bank Transfer"
  }
];

export const getOrdersByUserId = (userId) => orders.filter(o => o.userId === userId);
