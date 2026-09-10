export const users = [
  {
    id: 1,
    name: "Nguyễn Văn A",
    email: "nguyenvana@gmail.com",
    phone: "0901234567",
    password: "password123", // Lưu ý: Ở thực tế password sẽ được mã hóa
    avatar: "./assets/images/users/avatar-1.jpg",
    role: "customer", // customer hoặc admin
    address: "123 Đường Số 1, Quận 1, TP. Hồ Chí Minh"
  },
  {
    id: 2,
    name: "Trần Thị B",
    email: "tranthib@gmail.com",
    phone: "0987654321",
    password: "password123",
    avatar: "./assets/images/users/avatar-2.jpg",
    role: "admin",
    address: "456 Đường Lê Lợi, Quận Hải Châu, Đà Nẵng"
  }
];

// Giả lập lấy user đang đăng nhập (ví dụ user 1)
export const getCurrentUser = () => users[0];
export const getUserByEmail = (email) => users.find(u => u.email === email);
