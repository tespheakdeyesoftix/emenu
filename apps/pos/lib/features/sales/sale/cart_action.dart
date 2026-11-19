enum CartAction { edit, free, note, discount }

enum CartProductEdit {
  price('allow_change_price', 'PRODUCT_PRICE_CHANGE_NOT_ALLOWED'),
  free('allow_free', 'PRODUCT_FREE_NOT_ALLOWED'),
  discount('allow_discount', 'PRODUCT_DISCOUNT_NOT_ALLOWED');

  const CartProductEdit(this.option, this.warning);

  final String option;
  final String warning;

  static bool isWarning(String message) =>
      values.any((edit) => edit.warning == message);
}
