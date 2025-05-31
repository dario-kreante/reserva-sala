export function generateICSContent() {
  const calendarContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SmartCab//Booking System//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:booking-test-001@smartcab.com
DTSTAMP:20250528T120000Z
DTSTART:20250315T143000Z
DTEND:20250315T153000Z
SUMMARY:SmartCab Ride - Flight AA1234
DESCRIPTION:SmartCab Booking Details\\n\\nPickup: 123 Main Street\\, NYC\\nDropoff: 456 Broadway\\, NYC\\n\\nVehicle Type: Sedan\\nPassengers: 2\\nLuggage: 1 suitcase\\nFlight: AA1234\\n\\nDriver details will be sent 30 minutes before pickup.\\n\\nNeed help? Contact support@smartcab.com
LOCATION:123 Main Street\\, NYC
GEO:40.7580;-73.9855
CATEGORIES:TRANSPORTATION,BOOKING
STATUS:CONFIRMED
ORGANIZER;CN=SmartCab:mailto:bookings@smartcab.com
ATTENDEE;CN=Customer;RSVP=FALSE:mailto:customer@example.com
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:SmartCab pickup in 1 hour
END:VALARM
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:SmartCab pickup in 30 minutes - Driver details sent
END:VALARM
BEGIN:VALARM
TRIGGER:-PT10M
ACTION:DISPLAY
DESCRIPTION:SmartCab driver arriving in 10 minutes
END:VALARM
END:VEVENT
END:VCALENDAR`;

  return calendarContent;
}

export function downloadICSFile(content: string, filename: string = 'event.ics') {
  if (typeof window !== 'undefined') {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
