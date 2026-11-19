const PROFILE_CONFIG = {
  name: "Ageng Prayogo",
  role: "Website Taekwondo Ageng Prayogo",
  bio: "Menjadikan Atlet Taekwondo yang berakhlak",
  formUrl: "https://forms.gle/jLBjLbBpkVxGVbjj6",
  spreadsheetId: "1GYH7AmRQO8Klu4fgeOXgY3_ccS3YVl3KgGe2mPDHdU4"
};

// Elemen DOM Utama
const copyProfileBtn = document.getElementById("copyProfileBtn");
const toast = document.getElementById("toast");

// Elemen Modal Pencarian Atlet
const searchModal = document.getElementById("searchModal");
const openSearchModalBtn = document.getElementById("openSearchModalBtn");
const closeSearchModalBtn = document.getElementById("closeSearchModalBtn");
const athleteSearchForm = document.getElementById("athleteSearchForm");
const athleteSearchInput = document.getElementById("athleteSearchInput");
const searchStatus = document.getElementById("searchStatus");
const athleteSearchResults = document.getElementById("athleteSearchResults");

// Cache data dari Google Spreadsheet agar pencarian cepat & tidak membuka seluruh sheet ke pengguna
let cachedAthletes = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// Buka & Tutup Modal Pencarian
function openSearchModal() {
  resetSearchUI();
  searchModal.classList.add("active");
  searchModal.setAttribute("aria-hidden", "false");
  setTimeout(() => athleteSearchInput.focus(), 100);
}

function closeSearchModal() {
  searchModal.classList.remove("active");
  searchModal.setAttribute("aria-hidden", "true");
  resetSearchUI();
}

function resetSearchUI() {
  athleteSearchInput.value = "";
  searchStatus.style.display = "none";
  searchStatus.textContent = "";
  athleteSearchResults.style.display = "none";
  athleteSearchResults.innerHTML = "";
}

openSearchModalBtn.addEventListener("click", openSearchModal);
closeSearchModalBtn.addEventListener("click", closeSearchModal);
searchModal.addEventListener("click", (e) => {
  if (e.target === searchModal) closeSearchModal();
});

// Ambil data dari Google Sheets via Google Visualization JSON endpoint
async function fetchAthleteRows() {
  if (cachedAthletes) return cachedAthletes;

  const url = `https://docs.google.com/spreadsheets/d/${PROFILE_CONFIG.spreadsheetId}/gviz/tq?tqx=out:json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Gagal mengambil data dari server.");
  }

  const text = await response.text();
  // Ekstrak objek JSON dari pembungkus google.visualization.Query.setResponse(...)
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Format respons spreadsheet tidak valid.");
  }

  const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
  const table = data.table;
  const headers = table.cols.map((col, idx) => (col.label || `Kolom ${idx + 1}`).trim());

  const rows = (table.rows || []).map((row) => {
    const record = {};
    (row.c || []).forEach((cell, idx) => {
      const key = headers[idx] || `Kolom ${idx + 1}`;
      const val = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : cell.v) : "";
      record[key] = val !== null && val !== undefined ? String(val).trim() : "";
    });
    return record;
  });

  cachedAthletes = { headers, rows };
  return cachedAthletes;
}

// Hindari XSS saat merender teks dari spreadsheet
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Proses pencarian: HANYA menampilkan data yang cocok dengan kata kunci pencarian
athleteSearchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const keyword = athleteSearchInput.value.trim().toLowerCase();

  // Jika input kosong, jangan tampilkan data apa pun
  if (!keyword) {
    athleteSearchResults.style.display = "none";
    athleteSearchResults.innerHTML = "";
    searchStatus.style.display = "block";
    searchStatus.textContent = "Silakan ketik nama atlet terlebih dahulu.";
    return;
  }

  athleteSearchResults.style.display = "none";
  athleteSearchResults.innerHTML = "";
  searchStatus.style.display = "block";
  searchStatus.textContent = "Mencari data atlet...";

  try {
    const { headers, rows } = await fetchAthleteRows();

    // Cari kecocokan pada kolom nama (atau semua kolom kecuali timestamp)
    const nameHeaders = headers.filter((h) => /nama/i.test(h));
    const searchColumns = nameHeaders.length > 0
      ? nameHeaders
      : headers.filter((h) => !/timestamp|waktu/i.test(h));

    const matched = rows.filter((row) =>
      searchColumns.some((col) => (row[col] || "").toLowerCase().includes(keyword))
    );

    if (matched.length === 0) {
      searchStatus.textContent = `Data atlet dengan nama "${athleteSearchInput.value.trim()}" tidak ditemukan.`;
      return;
    }

    searchStatus.style.display = "none";
    athleteSearchResults.style.display = "flex";

    athleteSearchResults.innerHTML = matched
      .map((athlete) => {
        const titleKey = nameHeaders[0] || searchColumns[0] || headers[0];
        const titleValue = athlete[titleKey] || "Data Atlet";

        const detailsHtml = headers
          .filter((h) => h !== titleKey && !/timestamp/i.test(h) && athlete[h])
          .map(
            (h) => `
              <div class="athlete-detail-row">
                <span class="athlete-detail-label">${escapeHTML(h)}</span>
                <span class="athlete-detail-value">${escapeHTML(athlete[h])}</span>
              </div>
            `
          )
          .join("");

        return `
          <div class="athlete-card">
            <div class="athlete-card-title">${escapeHTML(titleValue)}</div>
            ${detailsHtml || '<div class="athlete-detail-row"><span class="athlete-detail-label">Status</span><span class="athlete-detail-value">Terdaftar</span></div>'}
          </div>
        `;
      })
      .join("");
  } catch (err) {
    searchStatus.style.display = "block";
    searchStatus.textContent =
      "Tidak dapat memuat data. Pastikan Google Spreadsheet diatur ke akses 'Siapa saja yang memiliki link dapat melihat'.";
  }
});

// Sembunyikan hasil segera jika kotak pencarian dikosongkan
athleteSearchInput.addEventListener("input", () => {
  if (!athleteSearchInput.value.trim()) {
    searchStatus.style.display = "none";
    athleteSearchResults.style.display = "none";
    athleteSearchResults.innerHTML = "";
  }
});

// Salin info profil ke clipboard
copyProfileBtn.addEventListener("click", async () => {
  const shareText = `${PROFILE_CONFIG.name} - ${PROFILE_CONFIG.role}\nFormulir Data Atlet: ${PROFILE_CONFIG.formUrl}`;
  try {
    await navigator.clipboard.writeText(shareText);
    showToast("Info profil & link disalin!");
  } catch {
    showToast("Gagal menyalin ke clipboard");
  }
});
