// Vietnamese translations for BookingCoo App
// Tất cả chuỗi văn bản tiếng Việt cho ứng dụng

export const vi = {
  // Common
  common: {
    loading: "Đang tải...",
    save: "Lưu",
    cancel: "Hủy",
    delete: "Xóa",
    edit: "Sửa",
    add: "Thêm",
    remove: "Gỡ bỏ",
    search: "Tìm kiếm",
    clear: "Xóa",
    submit: "Gửi",
    back: "Quay lại",
    next: "Tiếp",
    previous: "Trước",
    confirm: "Xác nhận",
    select: "Chọn",
    selected: "Đã chọn",
    available: "Có sẵn",
    total: "Tổng cộng",
    status: "Trạng thái",
    actions: "Hành động",
    details: "Chi tiết",
    notes: "Ghi chú",
    optional: "Tùy chọn",
    required: "Bắt buộc",
    all: "Tất cả",
  },

  // Booking
  booking: {
    title: "Đặt Bàn",
    createNew: "Tạo Đặt Bàn Mới",
    bookingDetails: "Chi Tiết Đặt Bàn",
    bookingList: "Danh Sách Đặt Bàn",
    bookDesk: "Đặt bàn và thêm món trong một lần",
    bookingId: "Mã Đặt Bàn",
    bookForLater: "Đặt Trước (Trạng thái: Chờ)",
    customerInfo: "Thông Tin Khách Hàng",
    enterCustomerDetails: "Nhập thông tin khách hàng",
    deskSelection: "Chọn Bàn & Thời Gian",
    chooseDeskDuration: "Chọn bàn và thời lượng đặt",
    selectDesk: "Chọn Bàn",
    chooseDesk: "Chọn một bàn",
    startTime: "Giờ Bắt Đầu",
    endTime: "Giờ Kết Thúc",
    duration: "Thời Lượng",
    hours: "giờ",
    deskCost: "Phí Bàn",
    comboSelected: "ĐÃ CHỌN GÓI COMBO",
    fixedDuration: "thời lượng cố định",
    autoCalculated: "Tự động tính từ combo",
    customerCheckinNow: "Khách đang check-in ngay. Trạng thái sẽ là 'Đã Check-in'.",
    customerCheckinLater: "Khách sẽ check-in khi đến. Trạng thái sẽ là 'Chờ'.",
    pendingStatus: "Chờ",
    checkedInStatus: "Đã Check-in",
    confirmedStatus: "Đã Xác Nhận",
    completedStatus: "Hoàn Thành",
    cancelledStatus: "Đã Hủy",
  },

  // Customer
  customer: {
    name: "Họ và Tên",
    fullName: "Họ và Tên",
    email: "Email",
    phone: "Số Điện Thoại",
    phonePlaceholder: "+84 123 456 789",
    namePlaceholder: "Nguyễn Văn A",
    emailPlaceholder: "nguyen@example.com",
  },

  // Items & Inventory
  items: {
    selectCombo: "Chọn Gói Combo",
    addItems: "Thêm Món",
    comboPackages: "Gói Combo",
    individualItems: "Món Đơn Lẻ",
    searchCombos: "Tìm combo...",
    searchItems: "Tìm món...",
    category: "Danh Mục",
    allCategories: "Tất Cả Danh Mục",
    food: "Đồ Ăn",
    beverage: "Đồ Uống",
    officeSupplies: "Văn Phòng Phẩm",
    merchandise: "Hàng Hóa",
    combos: "Combo",
    noComboFound: "Không tìm thấy gói combo",
    noItemsFound: "Không tìm thấy món nào",
    includes: "Bao gồm",
    hoursIncluded: "giờ bao gồm",
    packages: "gói",
    stock: "Tồn kho",
    each: "mỗi",
  },

  // Cart
  cart: {
    title: "Giỏ Hàng",
    noItems: "Không có món trong giỏ",
    addedToCart: "đã thêm vào giỏ hàng",
    comboCleared: "Đã xóa combo. Bạn có thể tự chọn thời lượng.",
  },

  // Payment
  payment: {
    summary: "Tổng Thanh Toán",
    status: "Trạng Thái Thanh Toán",
    deskRental: "Thuê Bàn",
    items: "Món",
    pending: "Chờ Thanh Toán",
    paid: "Đã Thanh Toán",
    refunded: "Đã Hoàn Tiền",
    paymentRequired: "Yêu Cầu Thanh Toán",
    paymentCompleted: "Thanh Toán Hoàn Tất",
    markCompleted: "Thanh toán sẽ được đánh dấu hoàn thành",
    processLater: "Có thể thanh toán sau",
    paymentStatusUpdated: "Trạng thái thanh toán đã cập nhật: Đã thanh toán",
  },

  // Actions
  actions: {
    createBooking: "Tạo Đặt Bàn",
    creatingBooking: "Đang tạo đặt bàn...",
    viewBilling: "Xem Hóa Đơn",
    checkout: "Hoàn Tất & Thanh Toán",
    payAndComplete: "Thanh Toán & Hoàn Tất",
    completeCheckout: "Hoàn Tất Trả Bàn",
  },

  // Validation & Errors
  validation: {
    enterName: "Vui lòng nhập tên khách hàng",
    selectDesk: "Vui lòng chọn bàn",
    selectStartTime: "Vui lòng chọn giờ bắt đầu",
    selectEndTime: "Vui lòng chọn giờ kết thúc",
    endAfterStart: "Giờ kết thúc phải sau giờ bắt đầu",
  },

  // Success Messages
  success: {
    bookingCreated: "Đã tạo đặt bàn thành công!",
    comboSelected: "đã được chọn! Thời lượng:",
  },

  // Error Messages  
  error: {
    createBookingFailed: "Tạo đặt bàn thất bại. Vui lòng thử lại.",
  },
};

export default vi;
