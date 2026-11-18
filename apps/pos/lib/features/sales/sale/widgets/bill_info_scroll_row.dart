import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

class BillInfoScrollRow extends StatefulWidget {
  const BillInfoScrollRow({super.key, required this.children});
  final List<Widget> children;

  @override
  State<BillInfoScrollRow> createState() => _BillInfoScrollRowState();
}

class _BillInfoScrollRowState extends State<BillInfoScrollRow> {
  final scroll = ScrollController();
  bool overflow = false, canGoLeft = false, canGoRight = false;
  double fullWidth = 0;

  @override
  void initState() {
    super.initState();
    scroll.addListener(updateEdges);
  }

  void updateEdges() {
    if (!mounted || !scroll.hasClients) return;
    final position = scroll.position;
    final next =
        position.maxScrollExtent + position.viewportDimension > fullWidth + 1;
    final left = position.pixels > 1;
    final right = position.pixels < position.maxScrollExtent - 1;
    if (next != overflow || left != canGoLeft || right != canGoRight) {
      setState(() {
        overflow = next;
        canGoLeft = left;
        canGoRight = right;
      });
    }
  }

  void move(int direction) {
    if (!scroll.hasClients) return;
    final target =
        (scroll.offset +
                direction *
                    math.max(120, scroll.position.viewportDimension * .8))
            .clamp(0.0, scroll.position.maxScrollExtent);
    if (MediaQuery.disableAnimationsOf(context)) {
      scroll.jumpTo(target);
    } else {
      scroll.animateTo(
        target,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => updateEdges());
    Widget arrow(bool left) => IconButton(
      tooltip: (left ? 'bill_scroll_left' : 'bill_scroll_right').tr,
      onPressed: (left ? canGoLeft : canGoRight)
          ? () => move(left ? -1 : 1)
          : null,
      icon: Icon(left ? Icons.chevron_left : Icons.chevron_right, size: 18),
      constraints: const BoxConstraints(minWidth: 28, minHeight: 40),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      visualDensity: VisualDensity.compact,
    );
    return LayoutBuilder(
      builder: (context, bounds) {
        fullWidth = bounds.maxWidth;
        return Row(
          children: [
            if (overflow) arrow(true),
            Expanded(
              child: NotificationListener<ScrollMetricsNotification>(
                onNotification: (_) {
                  WidgetsBinding.instance.addPostFrameCallback(
                    (_) => updateEdges(),
                  );
                  return false;
                },
                child: Listener(
                  onPointerSignal: (event) {
                    if (event is! PointerScrollEvent ||
                        !scroll.hasClients ||
                        event.scrollDelta.dx != 0) {
                      return;
                    }
                    final next = (scroll.offset + event.scrollDelta.dy).clamp(
                      0.0,
                      scroll.position.maxScrollExtent,
                    );
                    if (next == scroll.offset) return;
                    GestureBinding.instance.pointerSignalResolver.register(
                      event,
                      (_) => scroll.jumpTo(next),
                    );
                  },
                  child: ScrollConfiguration(
                    behavior: ScrollConfiguration.of(context).copyWith(
                      scrollbars: false,
                      dragDevices: {
                        PointerDeviceKind.mouse,
                        PointerDeviceKind.touch,
                        PointerDeviceKind.stylus,
                        PointerDeviceKind.trackpad,
                      },
                    ),
                    child: Scrollbar(
                      controller: scroll,
                      thumbVisibility: true,
                      thickness: 2,
                      child: SingleChildScrollView(
                        key: const ValueKey('bill-info-scroll'),
                        controller: scroll,
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          spacing: 5,
                          children: widget.children,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            if (overflow) arrow(false),
          ],
        );
      },
    );
  }
}
