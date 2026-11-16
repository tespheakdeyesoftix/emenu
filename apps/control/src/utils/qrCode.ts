import QRCode from "qrcode";

const colors = {
  dark: "#10231d",
  light: "#ffffff",
};

export function createMenuQrCode(menuUrl: string, width = 1200) {
  return QRCode.toDataURL(menuUrl, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 4,
    width,
    color: colors,
  });
}

