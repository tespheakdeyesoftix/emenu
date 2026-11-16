import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pdf;

Future<({PdfPageFormat format, Uint8List bytes})> receiptDocument({
  required Uint8List png,
  required double heightToWidth,
  required int widthMm,
  required int copies,
}) async {
  final width = widthMm * PdfPageFormat.mm;
  final format = PdfPageFormat(width, width * heightToWidth);
  final image = pdf.MemoryImage(png);
  final document = pdf.Document();
  for (var copy = 0; copy < copies; copy++) {
    document.addPage(
      pdf.Page(
        pageFormat: format,
        margin: pdf.EdgeInsets.zero,
        build: (_) => pdf.Image(image, fit: pdf.BoxFit.fill),
      ),
    );
  }
  return (format: format, bytes: await document.save());
}
