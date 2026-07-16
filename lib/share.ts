export async function shareViaWeb(data: {
  title: string;
  text: string;
  url?: string;
  files?: File[];
}): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  const shareData: ShareData = { title: data.title, text: data.text };
  if (data.url) {
    shareData.url = data.url;
  }
  if (data.files && data.files.length > 0 && canShareFiles(data.files)) {
    shareData.files = data.files;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (err) {
    // User cancelled or share failed
    return false;
  }
}

export function canShare(): boolean {
  return !!navigator.share;
}

export function canShareFiles(files: File[]): boolean {
  return !!(navigator.canShare && navigator.canShare({ files }));
}

export function getWhatsAppShareUrl(message: string, phoneNumber?: string): string {
  const encodedMessage = encodeURIComponent(message);
  if (phoneNumber) {
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}

export function getEmailShareUrl(
  subject: string,
  body: string,
  to?: string
): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${to || ""}?subject=${encodedSubject}&body=${encodedBody}`;
}
