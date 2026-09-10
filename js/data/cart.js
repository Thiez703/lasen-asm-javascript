export const cart = {
  userId: 1,
  items: [
    { 
      productId: 1, // Sen Đá Kim Cương 
      quantity: 2 
    },
    { 
      productId: 8, // Chậu Đất Nung Mini 
      quantity: 1 
    },
    { 
      productId: 10, // Phân Trì 
      quantity: 3 
    }
  ]
};

// Lưu ý: cart thường được lưu trong localStorage, đây chỉ là dữ liệu mẫu ban đầu.
export const getCart = () => cart;
