document.addEventListener("DOMContentLoaded", async () => {
  const descEl = document.getElementById("orgDescription");
  const purposeEl = document.getElementById("orgPurpose");
  if (descEl || purposeEl) {
    try {
      const org = await API.getOrganization();
      if (descEl) descEl.textContent = org.description || "সংগঠনের বিবরণ শীঘ্রই যুক্ত করা হবে।";
      if (purposeEl) purposeEl.textContent = org.purpose || "";
    } catch (e) {
      if (descEl) renderError(descEl);
    }
  }

  const contactRoot = document.getElementById("contactRoot");
  if (contactRoot) {
    try {
      const c = await API.getContact();
      const hasAny = c.address || c.phone || c.email;
      contactRoot.innerHTML = hasAny ? `
        <ul style="list-style:none;padding:0;">
          ${c.address ? `<li>ঠিকানা: ${c.address}</li>` : ""}
          ${c.phone ? `<li>ফোন: ${c.phone}</li>` : ""}
          ${c.email ? `<li>ইমেইল: ${c.email}</li>` : ""}
        </ul>` : `<p>যোগাযোগের তথ্য শীঘ্রই যুক্ত করা হবে।</p>`;
    } catch (e) {
      renderError(contactRoot);
    }
  }
});
