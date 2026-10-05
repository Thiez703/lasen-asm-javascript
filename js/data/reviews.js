export const reviews = [
  {
    id: 1,
    productId: 1,
    userId: 1,
    userName: "Nguyễn Văn A",
    rating: 5,
    comment: "Sữa rửa mặt dùng siêu thích, không bị khô căng. Rất phù hợp với da dầu mụn của mình.",
    date: "2026-09-02T14:30:00Z"
  },
  {
    id: 2,
    productId: 1,
    userId: 2,
    userName: "Trần Thị B",
    rating: 4,
    comment: "Hàng chuẩn chính hãng, giao hàng nhanh. Nhưng giá hơi cao so với sinh viên.",
    date: "2026-09-05T09:15:00Z"
  },
  {
    id: 3,
    productId: 8,
    userId: 1,
    userName: "Nguyễn Văn A",
    rating: 5,
    comment: "Son MAC màu Ruby Woo lên môi cực đỉnh, siêu tôn da. Mình rất ưng ý.",
    date: "2026-09-03T10:20:00Z"
  }
];

export const getReviewsByProductId = (productId) => reviews.filter(r => r.productId === productId);
