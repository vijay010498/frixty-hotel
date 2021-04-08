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

  //customer checked-in
  CheckedIn = "checkedIn",

  //customer checked-out
  CheckedOut = "checkedOut",

  //completed
  Completed = "completed",

  //customer not visited
  NotVisited = "notVisited",
}
