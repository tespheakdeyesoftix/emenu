import 'package:flutter/material.dart';

import 'cart_customer.dart';
import 'cart_bill_information.dart';

class CartHeader extends StatelessWidget {
  const CartHeader({super.key});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: 6,
    children: [const CartCustomer(), const CartBillInformation()],
  );
}
