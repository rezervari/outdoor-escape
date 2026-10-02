/*
 * Outdoor Escape — prezentarea panoului „Mesaje” (M6, D-086, D-090).
 *
 * Modul PUR, ca play-ui.js: din mesajele Inbox-ului (inbox.getMessages()) și starea efemeră a
 * panoului spune ce se desenează — numărul de necitite, lista (expeditor, text, categorie,
 * importanță, „nou”), starea goală — și ce mesaje devin citite.
 *
 * Citit (D-090): un mesaj devine citit când panoul este deschis ȘI mesajul este desenat în lista
 * vizibilă. `toMarkRead` se aplică (app.js) numai DUPĂ ce lista este în DOM, în panoul afișat.
 * Prima variantă, fără urmărirea zonei vizibile: un mesaj desenat în panoul deschis (cu derulare)
 * este considerat prezentat. Deschiderea panoului nu marchează nimic de una singură: un mesaj care
 * nu ajunge în listă rămâne necitit.
 *
 * `shownAsNew` (efemer, nesalvat): mesajele necitite la afișare rămân marcate „nou” cât timp panoul
 * este deschis, deși în Inbox au devenit citite — jucătorul vede ce a sosit de la ultima vizită.
 *
 * Nu apelează Inbox-ul, motorul sau DOM-ul, nu păstrează stare și nu știe nimic despre personaje:
 * expeditorul este doar `message.sender.name`. Textele de interfață sunt în app.js.
 */

export function describeInbox(messages, { open = false, shownAsNew = [] } = {}) {
  const unread = messages.filter((message) => !message.read).map((message) => message.id);
  return {
    open: Boolean(open),
    unreadCount: unread.length,
    empty: messages.length === 0,
    // Ordinea Inbox-ului (ordinea sosirii), fără sortare. `id` servește doar marcării ca citit.
    items: messages.map((message) => ({
      id: message.id,
      senderName: message.sender ? message.sender.name : null,
      text: message.text,
      category: message.category,
      importance: message.importance,
      isNew: !message.read || shownAsNew.includes(message.id),
    })),
    toMarkRead: open ? unread : [],
  };
}
