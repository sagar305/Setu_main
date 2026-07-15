import dynamic from "next/dynamic";

// Use Canvas for better PDF export compatibility
const QRCodeCanvas = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeCanvas), {
  ssr: false,
});

interface UPIQRCodeProps {
  upiId: string;
  amount?: number;
  businessName?: string;
}

export function UPIQRCode({ upiId, amount, businessName }: UPIQRCodeProps) {
  // UPI deeplink format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tr=REFERENCE
  const encodeURIComponent_ = (str: string) => encodeURIComponent(str);

  const upiUrl = `upi://pay?pa=${encodeURIComponent_(upiId)}${
    businessName ? `&pn=${encodeURIComponent_(businessName)}` : ""
  }${amount ? `&am=${amount}` : ""}&tn=Invoice%20Payment`;

  if (!upiId) return null;

  return (
    <div className="flex justify-center">
      <QRCodeCanvas
        value={upiUrl}
        size={128}
        level="H"
        includeMargin={true}
        fgColor="#000000"
        bgColor="#ffffff"
      />
    </div>
  );
}
