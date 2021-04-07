export enum BookingStatus {
  //Booking created and Confirmed, completed
  Confirmed = "confirmed",

  //Booking Cancelled
  Cancelled = "cancelled",

  //payment initiated
  AwaitingPayment = "awaitingPayment",

  //payment Processing
  ProcessingPayment = "processingPayment",

  //payment Failed
  PaymentFailed = "paymentFailed",

  //payment cancelled
  PaymentCancelled = "paymentCancelled",

  //payment Refunded
  PaymentRefunded = "paymentRefunded",
}
