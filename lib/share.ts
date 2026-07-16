export async function shareViaWeb(data: {
  title: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    await navigator.share(data);
    return true;
  } catch (err) {
    // User cancelled or share failed
    return false;
  }
}

export function canShare(): boolean {
  return !!navigator.share;
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
