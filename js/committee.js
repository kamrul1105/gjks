document.addEventListener("DOMContentLoaded", async () => {
  const mainWrap = document.getElementById("mainCommittee");
  const fieldWrap = document.getElementById("fieldCommittee");
  if (!mainWrap && !fieldWrap) return;

  try {
    const committee = await API.getCommittee();
    if (mainWrap) renderCommittee(mainWrap, committee.main);
    if (fieldWrap) renderCommittee(fieldWrap, committee.field);
  } catch (e) {
    if (mainWrap) renderError(mainWrap);
    if (fieldWrap) renderError(fieldWrap);
  }
});

function renderCommittee(container, people) {
  if (!people || !people.length) return renderEmpty(container, "কমিটির তথ্য শীঘ্রই যুক্ত করা হবে।");
  const sorted = [...people].sort((a, b) => (a.order || 0) - (b.order || 0));
  container.innerHTML = sorted.map(p => `
    <div class="committee-card ${p.president ? "president" : ""}">
      ${p.photoUrl
        ? `<img src="${p.photoUrl}" alt="${p.name}">`
        : `<img src="data:image/svg+xml;utf8,${placeholderAvatar()}" alt="${p.name}">`}
      <h4>${p.name}</h4>
      <div class="role">${p.position}</div>
    </div>
  `).join("");
}

function placeholderAvatar() {
  return encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#E7E4D9'/><circle cx='50' cy='38' r='18' fill='#B7B29F'/><path d='M18 90c4-24 24-34 32-34s28 10 32 34' fill='#B7B29F'/></svg>`
  );
}
