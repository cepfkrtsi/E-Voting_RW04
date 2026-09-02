/* =====================================================
   E-VOTING RW 04
   ADMIN JAVASCRIPT

   FULL FINAL VERSION

   FITUR:
   - Validasi token sebelum dashboard
   - Token expired / invalid otomatis logout
   - Network error tidak langsung logout
   - Request timeout
   - Login timeout lebih panjang
   - Mencegah request bertumpuk
   - Dashboard, voters, results, logs paralel
   - Refresh aman
   - Error API lebih jelas
   - Tetap kompatibel dengan HTML admin
===================================================== */


/* =====================================================
   API URL
===================================================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycbw-yX3a_9GzhCCtByS4g_IXRJsVhMN-CnvJsKQ0EFu-01n_mwa_Jftt6ex9IlYtHQ0W0g/exec";


/* =====================================================
   CONFIG
===================================================== */

const API_TIMEOUT =
  15000;

const LOGIN_TIMEOUT =
  20000;


/* =====================================================
   STATE
===================================================== */

let adminToken =
  localStorage.getItem("admin_token");

let currentDashboard =
  null;

let currentVoters =
  [];

let isLoadingAllData =
  false;

let isLoggingIn =
  false;


/* =====================================================
   INITIALIZE
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    setupNavigation();

    setupEvents();


    /*
     * JANGAN langsung membuka dashboard
     * hanya karena localStorage mempunyai token.
     *
     * Token harus diverifikasi ke backend.
     */

    if (!adminToken) {

      showLogin();

      return;

    }


    /*
     * Selama token diverifikasi,
     * jangan tampilkan dashboard sebagai
     * sesi yang sudah authenticated.
     */

    showDashboardLoading();


    const validation =
      await validateAdminSession();


    /*
     * Token valid.
     */

    if (
      validation.valid === true
    ) {

      showDashboard();


      if (currentDashboard) {

        renderDashboard(
          currentDashboard
        );

      }


      await loadAllData();

      return;

    }


    /*
     * Jika token memang invalid / expired,
     * hapus token.
     */

    if (
      validation.authError === true
    ) {

      forceLogout();


      showLoginMessage(
        "Sesi admin telah berakhir. Silakan login kembali.",
        "error"
      );


      return;

    }


    /*
     * Jika gagal karena jaringan/server,
     * jangan menganggap token valid.
     *
     * Tampilkan login agar dashboard tidak
     * terbuka tanpa validasi.
     */

    showLogin();


    showLoginMessage(
      validation.message ||
      "Server belum dapat dihubungi. Silakan login kembali atau coba lagi.",
      "error"
    );

  }
);


/* =====================================================
   ELEMENT HELPER
===================================================== */

function $(id) {

  return document.getElementById(
    id
  );

}


/* =====================================================
   EVENT
===================================================== */

function setupEvents() {

  if ($("loginForm")) {

    $("loginForm")
      .addEventListener(
        "submit",
        handleAdminLogin
      );

  }


  if ($("logoutButton")) {

    $("logoutButton")
      .addEventListener(
        "click",
        adminLogoutAction
      );

  }


  if ($("refreshButton")) {

    $("refreshButton")
      .addEventListener(
        "click",
        function () {

          loadAllData(
            true
          );

        }
      );

  }


  if ($("mobileRefreshButton")) {

    $("mobileRefreshButton")
      .addEventListener(
        "click",
        function () {

          loadAllData(
            true
          );

        }
      );

  }


  if ($("refreshVotersButton")) {

    $("refreshVotersButton")
      .addEventListener(
        "click",
        function () {

          runProtectedAction(
            loadVoters
          );

        }
      );

  }


  if ($("refreshResultsButton")) {

    $("refreshResultsButton")
      .addEventListener(
        "click",
        function () {

          runProtectedAction(
            loadResults
          );

        }
      );

  }


  if ($("refreshLogsButton")) {

    $("refreshLogsButton")
      .addEventListener(
        "click",
        function () {

          runProtectedAction(
            loadLogs
          );

        }
      );

  }


  if ($("refreshRankingButton")) {

    $("refreshRankingButton")
      .addEventListener(
        "click",
        function () {

          runProtectedAction(
            loadResults
          );

        }
      );

  }


  if ($("refreshDashboardChart")) {

    $("refreshDashboardChart")
      .addEventListener(
        "click",
        function () {

          runProtectedAction(
            loadDashboard
          );

        }
      );

  }


  if ($("saveStatusButton")) {

    $("saveStatusButton")
      .addEventListener(
        "click",
        saveElectionStatus
      );

  }


  if ($("sidebarToggle")) {

    $("sidebarToggle")
      .addEventListener(
        "click",
        toggleSidebar
      );

  }


  if ($("sidebarOverlay")) {

    $("sidebarOverlay")
      .addEventListener(
        "click",
        closeSidebar
      );

  }

}


/* =====================================================
   PROTECTED ACTION
===================================================== */

/**
 * Mencegah async event handler menghasilkan
 * unhandled promise rejection.
 */
async function runProtectedAction(
  action
) {

  try {

    await action();

  } catch (error) {

    console.error(
      "PROTECTED ACTION ERROR:",
      error
    );


    if (
      isAuthenticationError(
        error
      )
    ) {

      forceLogout();


      showLoginMessage(
        "Sesi admin telah berakhir. Silakan login kembali.",
        "error"
      );

      return;

    }


    showToast(
      error.message ||
      "Terjadi kesalahan."
    );

  }

}


/* =====================================================
   NAVIGATION
===================================================== */

function setupNavigation() {

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const section =
              button.dataset.section;


            switchSection(
              section
            );


            closeSidebar();

          }
        );

      }
    );

}


function switchSection(
  section
) {

  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      function (item) {

        item.classList.toggle(
          "active",
          item.dataset.section ===
            section
        );

      }
    );


  document
    .querySelectorAll(
      ".content-section"
    )
    .forEach(
      function (item) {

        item.classList.remove(
          "active-section"
        );

      }
    );


  const target =
    $("section-" + section);


  if (target) {

    target.classList.add(
      "active-section"
    );

  }


  const titles = {

    overview: [
      "Dashboard",
      "Pantau proses pemilihan secara real-time."
    ],

    voters: [
      "Data Pemilih",
      "Daftar pemilih yang terdaftar dalam sistem."
    ],

    results: [
      "Hasil & Ranking",
      "Perolehan suara setiap calon."
    ],

    logs: [
      "Log Aktivitas",
      "Riwayat aktivitas sistem."
    ],

    settings: [
      "Pengaturan",
      "Pengaturan status pemilihan."
    ]

  };


  const data =
    titles[section] ||
    titles.overview;


  if ($("pageTitle")) {

    $("pageTitle")
      .textContent =
        data[0];

  }


  if ($("pageSubtitle")) {

    $("pageSubtitle")
      .textContent =
        data[1];

  }

}


/* =====================================================
   SIDEBAR
===================================================== */

function toggleSidebar() {

  if ($("sidebar")) {

    $("sidebar")
      .classList.toggle(
        "open"
      );

  }


  if ($("sidebarOverlay")) {

    $("sidebarOverlay")
      .classList.toggle(
        "show"
      );

  }

}


function closeSidebar() {

  if ($("sidebar")) {

    $("sidebar")
      .classList.remove(
        "open"
      );

  }


  if ($("sidebarOverlay")) {

    $("sidebarOverlay")
      .classList.remove(
        "show"
      );

  }

}


/* =====================================================
   API REQUEST
===================================================== */

/**
 * POST request ke Google Apps Script
 * dengan timeout.
 */
async function apiRequest(
  action,
  data = {},
  timeout = API_TIMEOUT
) {

  const payload = {

    action:
      action,

    ...data

  };


  const controller =
    new AbortController();


  const timeoutId =
    setTimeout(
      function () {

        controller.abort();

      },
      timeout
    );


  try {

    const response =
      await fetch(
        API_URL,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "text/plain;charset=utf-8",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify(
              payload
            ),

          cache:
            "no-store",

          signal:
            controller.signal

        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "HTTP Error " +
        response.status
      );

    }


    const text =
      await response.text();


    if (!text) {

      throw new Error(
        "Server mengembalikan respons kosong."
      );

    }


    let result;


    try {

      result =
        JSON.parse(
          text
        );

    } catch (jsonError) {

      console.error(
        "INVALID JSON RESPONSE:",
        text
      );


      throw new Error(
        "Respons server tidak valid."
      );

    }


    return result;

  } catch (error) {

    if (
      error &&
      error.name ===
        "AbortError"
    ) {

      throw new Error(
        "Koneksi ke server timeout. Silakan coba lagi."
      );

    }


    if (
      error instanceof
        TypeError
    ) {

      throw new Error(
        "Tidak dapat terhubung ke server. Periksa koneksi internet atau Web App Google Apps Script."
      );

    }


    throw error;

  } finally {

    clearTimeout(
      timeoutId
    );

  }

}


/* =====================================================
   SESSION VALIDATION
===================================================== */

/**
 * Hasil:
 *
 * {
 *   valid: true
 * }
 *
 * atau:
 *
 * {
 *   valid: false,
 *   authError: true
 * }
 *
 * atau:
 *
 * {
 *   valid: false,
 *   authError: false
 * }
 */
async function validateAdminSession() {

  if (!adminToken) {

    return {

      valid: false,

      authError: true,

      message:
        "Sesi admin tidak tersedia."

    };

  }


  try {

    const result =
      await apiRequest(
        "admin_dashboard",
        {

          token:
            adminToken

        }
      );


    console.log(
      "SESSION VALIDATION:",
      result
    );


    if (
      !result ||
      result.success !== true
    ) {

      const message =
        result?.message ||
        "Sesi admin tidak valid.";


      return {

        valid: false,

        authError:
          isAuthenticationMessage(
            message
          ),

        message:
          message

      };

    }


    currentDashboard =
      result.dashboard ||
      {};


    return {

      valid: true,

      authError: false

    };

  } catch (error) {

    console.error(
      "SESSION VALIDATION ERROR:",
      error
    );


    /*
     * Timeout/network error:
     * JANGAN dianggap sebagai token expired.
     */

    if (
      isAuthenticationError(
        error
      )
    ) {

      return {

        valid: false,

        authError: true,

        message:
          error.message

      };

    }


    return {

      valid: false,

      authError: false,

      message:
        error.message ||
        "Server belum dapat dihubungi."

    };

  }

}


/* =====================================================
   LOGIN
===================================================== */

async function handleAdminLogin(
  event
) {

  event.preventDefault();


  if (
    isLoggingIn
  ) {

    return;

  }


  const usernameElement =
    $("username");


  const passwordElement =
    $("password");


  const loginButton =
    $("loginButton");


  if (
    !usernameElement ||
    !passwordElement
  ) {

    return;

  }


  const username =
    usernameElement.value.trim();


  const password =
    passwordElement.value;


  if (
    !username ||
    !password
  ) {

    showLoginMessage(
      "Username dan password wajib diisi.",
      "error"
    );


    return;

  }


  isLoggingIn =
    true;


  if (loginButton) {

    loginButton.disabled =
      true;

    loginButton.textContent =
      "Menghubungkan...";

  }


  try {

    /*
     * Token lama tidak boleh digunakan
     * ketika proses login baru.
     */

    localStorage.removeItem(
      "admin_token"
    );


    sessionStorage.removeItem(
      "admin_token"
    );


    sessionStorage.removeItem(
      "evoting_admin_token"
    );


    adminToken =
      null;


    const result =
      await apiRequest(
        "admin_login",
        {

          username:
            username,

          password:
            password

        },
        LOGIN_TIMEOUT
      );


    console.log(
      "LOGIN RESPONSE:",
      result
    );


    if (
      !result ||
      result.success !== true
    ) {

      showLoginMessage(
        result?.message ||
        "Username atau password salah.",
        "error"
      );


      return;

    }


    /*
     * Pastikan token benar-benar diterima.
     */

    if (
      !result.token
    ) {

      throw new Error(
        "Login berhasil tetapi token admin tidak diterima."
      );

    }


    adminToken =
      String(
        result.token
      ).trim();


    if (!adminToken) {

      throw new Error(
        "Token admin kosong."
      );

    }


    /*
     * Simpan token.
     */

    localStorage.setItem(
      "admin_token",
      adminToken
    );


    showLoginMessage(
      "Login berhasil. Memverifikasi sesi...",
      "success"
    );


    /*
     * WAJIB validasi token baru.
     */

    const validation =
      await validateAdminSession();


    if (
      validation.valid !== true
    ) {

      forceLogout();


      showLoginMessage(
        validation.message ||
        "Sesi admin tidak dapat diverifikasi. Silakan login kembali.",
        "error"
      );


      return;

    }


    /*
     * Token benar-benar valid.
     */

    showDashboard();


    if (
      currentDashboard
    ) {

      renderDashboard(
        currentDashboard
      );

    }


    /*
     * Load data lainnya.
     */

    await loadAllData();

  } catch (error) {

    console.error(
      "ADMIN LOGIN ERROR:",
      error
    );


    localStorage.removeItem(
      "admin_token"
    );


    adminToken =
      null;


    showLogin();


    showLoginMessage(
      error.message ||
      "Tidak dapat terhubung ke server.",
      "error"
    );

  } finally {

    isLoggingIn =
      false;


    if (loginButton) {

      loginButton.disabled =
        false;

      loginButton.textContent =
        "Login Admin";

    }

  }

}


/* =====================================================
   SHOW LOGIN
===================================================== */

function showLogin() {

  if ($("loginPage")) {

    $("loginPage")
      .classList.remove(
        "hidden"
      );

  }


  if ($("dashboardPage")) {

    $("dashboardPage")
      .classList.add(
        "hidden"
      );

  }

}


/* =====================================================
   SHOW DASHBOARD
===================================================== */

function showDashboard() {

  if ($("loginPage")) {

    $("loginPage")
      .classList.add(
        "hidden"
      );

  }


  if ($("dashboardPage")) {

    $("dashboardPage")
      .classList.remove(
        "hidden"
      );

  }

}


/* =====================================================
   DASHBOARD LOADING
===================================================== */

function showDashboardLoading() {

  /*
   * Penting:
   *
   * Dashboard TIDAK dibuka ketika token
   * belum berhasil divalidasi.
   *
   * Jadi halaman login tetap menjadi
   * halaman default.
   */

  showLogin();


  /*
   * Jika tersedia elemen login message,
   * berikan informasi.
   */

  showLoginMessage(
    "Memverifikasi sesi admin...",
    "success"
  );

}


/* =====================================================
   LOGIN MESSAGE
===================================================== */

function showLoginMessage(
  message,
  type
) {

  const element =
    $("loginMessage");


  if (!element) {

    return;

  }


  element.textContent =
    message || "";


  element.className =
    "message " +
    (type || "");

}


/* =====================================================
   LOAD ALL DATA
===================================================== */

async function loadAllData(
  showNotification = false
) {

  if (!adminToken) {

    forceLogout();

    return;

  }


  if (
    isLoadingAllData
  ) {

    return;

  }


  isLoadingAllData =
    true;


  setRefreshButtonsDisabled(
    true
  );


  try {

    /*
     * Dashboard sekaligus menjadi
     * validasi session terbaru.
     */

    await loadDashboard();


    /*
     * Setelah dashboard valid,
     * load data lainnya secara paralel.
     *
     * Promise.allSettled membuat satu endpoint
     * gagal tidak menghentikan endpoint lain.
     */

    const results =
      await Promise.allSettled(
        [

          loadVoters(),

          loadResults(),

          loadLogs()

        ]
      );


    /*
     * Periksa apakah ada authentication error.
     */

    const authFailure =
      results.find(
        function (item) {

          return (
            item.status ===
              "rejected" &&
            isAuthenticationError(
              item.reason
            )
          );

        }
      );


    if (
      authFailure
    ) {

      forceLogout();


      showLoginMessage(
        "Sesi admin telah berakhir. Silakan login kembali.",
        "error"
      );


      return;

    }


    /*
     * Jika ada request biasa yang gagal,
     * jangan logout.
     */

    const failedCount =
      results.filter(
        function (item) {

          return (
            item.status ===
            "rejected"
          );

        }
      ).length;


    if (
      showNotification
    ) {

      if (
        failedCount === 0
      ) {

        showToast(
          "Data admin berhasil diperbarui."
        );

      } else {

        showToast(
          "Sebagian data gagal dimuat. Silakan coba refresh kembali."
        );

      }

    }

  } catch (error) {

    console.error(
      "LOAD ALL ERROR:",
      error
    );


    if (
      isAuthenticationError(
        error
      )
    ) {

      forceLogout();


      showLoginMessage(
        "Sesi admin telah berakhir. Silakan login kembali.",
        "error"
      );


      return;

    }


    if (
      showNotification
    ) {

      showToast(
        error.message ||
        "Gagal memperbarui data."
      );

    }

  } finally {

    isLoadingAllData =
      false;


    setRefreshButtonsDisabled(
      false
    );

  }

}


/* =====================================================
   REFRESH BUTTON STATE
===================================================== */

function setRefreshButtonsDisabled(
  disabled
) {

  const ids = [

    "refreshButton",

    "mobileRefreshButton"

  ];


  ids.forEach(
    function (id) {

      const button =
        $(id);


      if (
        button
      ) {

        button.disabled =
          disabled;

      }

    }
  );

}


/* =====================================================
   AUTHENTICATION ERROR
===================================================== */

function isAuthenticationError(
  error
) {

  if (
    !error
  ) {

    return false;

  }


  return isAuthenticationMessage(
    error.message
  );

}


function isAuthenticationMessage(
  message
) {

  const text =
    String(
      message || ""
    )
    .toLowerCase();


  const authKeywords = [

    "sesi admin tidak valid",

    "sesi admin tidak tersedia",

    "sesi admin telah berakhir",

    "sesi tidak valid",

    "session invalid",

    "session expired",

    "token tidak valid",

    "token invalid",

    "token expired",

    "unauthorized",

    "tidak diizinkan",

    "tidak memiliki akses",

    "akses ditolak",

    "autentikasi gagal",

    "authentication failed"

  ];


  return authKeywords.some(
    function (keyword) {

      return text.includes(
        keyword
      );

    }
  );

}


/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

  if (!adminToken) {

    throw new Error(
      "Sesi admin tidak tersedia."
    );

  }


  const result =
    await apiRequest(
      "admin_dashboard",
      {

        token:
          adminToken

      }
    );


  console.log(
    "ADMIN DASHBOARD RESPONSE:",
    result
  );


  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      result?.message ||
      "Sesi admin tidak valid."
    );

  }


  currentDashboard =
    result.dashboard ||
    {};


  renderDashboard(
    currentDashboard
  );


  return currentDashboard;

}


/* =====================================================
   RENDER DASHBOARD
===================================================== */

function renderDashboard(
  dashboard
) {

  dashboard =
    dashboard ||
    {};


  /*
   * NAMA PEMILIHAN
   */

  if (
    $("electionNameHeader")
  ) {

    $("electionNameHeader")
      .textContent =
        dashboard.nama_pemilihan ||
        "Pemilihan Ketua Pemuda/Pemudi RW 04";

  }


  /*
   * STATUS
   */

  const status =
    String(
      dashboard.status_pemilihan ||
      "BELUM_DIMULAI"
    )
    .toUpperCase();


  if (
    $("electionStatus")
  ) {

    $("electionStatus")
      .textContent =
        status;


    $("electionStatus")
      .className =
        "status-badge " +
        getStatusClass(
          status
        );

  }


  /*
   * STATISTIK PEMILIH
   */

  const voter =
    dashboard.voter ||
    {};


  const total =
    Number(
      voter.total ||
      0
    );


  const sudah =
    Number(
      voter.sudah_memilih ||
      0
    );


  const belum =
    Number(
      voter.belum_memilih ||
      0
    );


  const persen =
    Number(
      voter.persentase ||
      0
    );


  console.log(
    "VOTER STATISTICS:",
    {

      total,
      sudah,
      belum,
      persen

    }
  );


  if (
    $("totalVoters")
  ) {

    $("totalVoters")
      .textContent =
        formatNumber(
          total
        );

  }


  if (
    $("votedVoters")
  ) {

    $("votedVoters")
      .textContent =
        formatNumber(
          sudah
        );

  }


  if (
    $("notVotedVoters")
  ) {

    $("notVotedVoters")
      .textContent =
        formatNumber(
          belum
        );

  }


  if (
    $("participation")
  ) {

    $("participation")
      .textContent =
        persen +
        "%";

  }


  if (
    $("legendVoted")
  ) {

    $("legendVoted")
      .textContent =
        formatNumber(
          sudah
        );

  }


  if (
    $("legendNotVoted")
  ) {

    $("legendNotVoted")
      .textContent =
        formatNumber(
          belum
        );

  }


  if (
    $("donutPercentage")
  ) {

    $("donutPercentage")
      .textContent =
        persen +
        "%";

  }


  /*
   * DONUT CHART
   */

  const degrees =
    Math.max(
      0,
      Math.min(
        360,
        persen *
          3.6
      )
    );


  if (
    $("donutChart")
  ) {

    $("donutChart")
      .style
      .background =
        "conic-gradient(" +
        "var(--success) 0deg " +
        degrees +
        "deg, " +
        "#e5e7eb " +
        degrees +
        "deg 360deg" +
        ")";

  }


  /*
   * SETTINGS
   */

  if (
    $("statusSelect")
  ) {

    $("statusSelect")
      .value =
        status;

  }


  if (
    $("settingsPeriod")
  ) {

    $("settingsPeriod")
      .textContent =
        dashboard.periode ||
        "-";

  }


  if (
    $("startDate")
  ) {

    $("startDate")
      .textContent =
        dashboard.tanggal_mulai ||
        "-";

  }


  if (
    $("endDate")
  ) {

    $("endDate")
      .textContent =
        dashboard.tanggal_selesai ||
        "-";

  }


  if (
    $("resultVisibility")
  ) {

    $("resultVisibility")
      .textContent =
        dashboard.hasil_ditampilkan ||
        "-";

  }

}


/* =====================================================
   STATUS CLASS
===================================================== */

function getStatusClass(
  status
) {

  if (
    status ===
    "BERLANGSUNG"
  ) {

    return "status-berlangsung";

  }


  if (
    status ===
    "SELESAI"
  ) {

    return "status-selesai";

  }


  return "status-belum";

}


/* =====================================================
   SAVE STATUS
===================================================== */

async function saveElectionStatus() {

  if (!adminToken) {

    forceLogout();

    return;

  }


  const statusElement =
    $("statusSelect");


  if (!statusElement) {

    return;

  }


  const status =
    statusElement.value;


  if (
    !confirm(
      "Ubah status pemilihan menjadi:\n\n" +
      status +
      "?"
    )
  ) {

    return;

  }


  const button =
    $("saveStatusButton");


  if (
    button
  ) {

    button.disabled =
      true;

    button.textContent =
      "Menyimpan...";

  }


  try {

    const result =
      await apiRequest(
        "admin_set_status",
        {

          token:
            adminToken,

          status:
            status

        }
      );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Gagal mengubah status."
      );

    }


    showToast(
      "Status pemilihan berhasil diubah."
    );


    await loadDashboard();

  } catch (error) {

    console.error(
      "SAVE STATUS ERROR:",
      error
    );


    if (
      isAuthenticationError(
        error
      )
    ) {

      forceLogout();


      showLoginMessage(
        "Sesi admin telah berakhir. Silakan login kembali.",
        "error"
      );


      return;

    }


    alert(
      error.message ||
      "Terjadi kesalahan saat mengubah status."
    );

  } finally {

    if (
      button
    ) {

      button.disabled =
        false;

      button.textContent =
        "Simpan Status";

    }

  }

}


/* =====================================================
   LOAD VOTERS
===================================================== */

async function loadVoters() {

  const tbody =
    $("votersTableBody");


  if (!tbody) {

    return;

  }


  tbody.innerHTML =
    `
      <tr>
        <td
          colspan="5"
          class="loading-cell"
        >
          Memuat data pemilih...
        </td>
      </tr>
    `;


  try {

    if (!adminToken) {

      throw new Error(
        "Sesi admin tidak tersedia."
      );

    }


    const result =
      await apiRequest(
        "admin_voters",
        {

          token:
            adminToken

        }
      );


    console.log(
      "VOTERS RESPONSE:",
      result
    );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Gagal mengambil data pemilih."
      );

    }


    currentVoters =
      Array.isArray(
        result.pemilih
      )
        ? result.pemilih
        : [];


    renderVoters(
      currentVoters
    );


    return currentVoters;

  } catch (error) {

    console.error(
      "VOTERS ERROR:",
      error
    );


    tbody.innerHTML =
      `
        <tr>
          <td
            colspan="5"
            class="loading-cell"
          >
            ${escapeHtml(
              error.message ||
              "Gagal mengambil data pemilih."
            )}
          </td>
        </tr>
      `;


    if (
      isAuthenticationError(
        error
      )
    ) {

      throw error;

    }


    return null;

  }

}


/* =====================================================
   RENDER VOTERS
===================================================== */

function renderVoters(
  voters
) {

  const tbody =
    $("votersTableBody");


  if (!tbody) {

    return;

  }


  tbody.innerHTML =
    "";


  if (
    !Array.isArray(
      voters
    ) ||
    !voters.length
  ) {

    tbody.innerHTML =
      `
        <tr>
          <td
            colspan="5"
            class="loading-cell"
          >
            Belum ada data pemilih.
          </td>
        </tr>
      `;


    return;

  }


  voters.forEach(
    function (
      voter,
      index
    ) {

      const status =
        String(
          voter.status ||
          "BELUM"
        )
        .toUpperCase();


      const statusClass =
        status ===
          "SUDAH"
          ? "status-sudah"
          : "status-belum";


      const tr =
        document.createElement(
          "tr"
        );


      tr.innerHTML =
        `
          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHtml(
              voter.id_pemilih
            )}
          </td>

          <td>
            ${escapeHtml(
              voter.nama
            )}
          </td>

          <td>
            <span
              class="status-badge ${statusClass}"
            >
              ${escapeHtml(
                status
              )}
            </span>
          </td>

          <td>
            ${escapeHtml(
              voter.waktu_memilih ||
              "-"
            )}
          </td>
        `;


      tbody.appendChild(
        tr
      );

    }
  );

}


/* =====================================================
   LOAD RESULTS
===================================================== */

async function loadResults() {

  try {

    if (!adminToken) {

      throw new Error(
        "Sesi admin tidak tersedia."
      );

    }


    const result =
      await apiRequest(
        "admin_results",
        {

          token:
            adminToken

        }
      );


    console.log(
      "RESULTS RESPONSE:",
      result
    );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Gagal mengambil hasil."
      );

    }


    const results =
      Array.isArray(
        result.hasil
      )
        ? result.hasil
        : [];


    renderResults(
      results
    );


    renderRanking(
      results
    );


    renderCandidateChart(
      results
    );


    return results;

  } catch (error) {

    console.error(
      "RESULT ERROR:",
      error
    );


    const container =
      $("resultsContainer");


    if (container) {

      container.innerHTML =
        `
          <div class="loading-box">
            ${escapeHtml(
              error.message ||
              "Gagal mengambil hasil pemilihan."
            )}
          </div>
        `;

    }


    if (
      isAuthenticationError(
        error
      )
    ) {

      throw error;

    }


    return null;

  }

}


/* =====================================================
   NORMALIZE RESULTS
===================================================== */

function normalizeResults(
  results
) {

  if (
    !Array.isArray(
      results
    )
  ) {

    return [];

  }


  return results
    .map(
      function (
        item
      ) {

        return {

          id_calon:
            item.id_calon ||
            item.calon_id ||
            "",

          nomor_urut:
            Number(
              item.nomor_urut ||
              0
            ),

          nama:
            item.nama ||
            "Tanpa Nama",

          suara:
            Number(
              item.suara ||
              0
            )

        };

      }
    )
    .sort(
      function (
        a,
        b
      ) {

        return (
          b.suara -
          a.suara
        );

      }
    );

}


/* =====================================================
   RANKING
===================================================== */

function renderRanking(
  results
) {

  const container =
    $("rankingContainer");


  if (!container) {

    return;

  }


  const data =
    normalizeResults(
      results
    );


  container.innerHTML =
    "";


  if (
    !data.length
  ) {

    container.innerHTML =
      `
        <div class="loading-box">
          Belum ada data calon.
        </div>
      `;


    return;

  }


  data.forEach(
    function (
      item,
      index
    ) {

      const rank =
        index + 1;


      let rankClass =
        "";


      if (
        rank === 1
      ) {

        rankClass =
          "first";

      } else if (
        rank === 2
      ) {

        rankClass =
          "second";

      } else if (
        rank === 3
      ) {

        rankClass =
          "third";

      }


      const div =
        document.createElement(
          "div"
        );


      div.className =
        "ranking-item";


      div.innerHTML =
        `
          <div
            class="rank-number ${rankClass}"
          >
            ${rank}
          </div>

          <div class="rank-info">

            <strong>
              ${escapeHtml(
                item.nama
              )}
            </strong>

            <small>
              Nomor urut
              ${item.nomor_urut}
            </small>

          </div>

          <div class="rank-votes">
            ${formatNumber(
              item.suara
            )}
            suara
          </div>
        `;


      container.appendChild(
        div
      );

    }
  );

}


/* =====================================================
   CANDIDATE BAR CHART
===================================================== */

function renderCandidateChart(
  results
) {

  const container =
    $("candidateChart");


  if (!container) {

    return;

  }


  const data =
    normalizeResults(
      results
    );


  container.innerHTML =
    "";


  if (
    !data.length
  ) {

    container.innerHTML =
      `
        <div class="loading-box">
          Belum ada suara.
        </div>
      `;


    return;

  }


  const maxVotes =
    Math.max(
      ...data.map(
        function (
          item
        ) {

          return item.suara;

        }
      ),
      1
    );


  data.forEach(
    function (
      item
    ) {

      const percentage =
        item.suara > 0
          ? (
              item.suara /
              maxVotes
            ) *
            100
          : 0;


      const row =
        document.createElement(
          "div"
        );


      row.className =
        "candidate-bar-row";


      row.innerHTML =
        `
          <div class="candidate-label">
            #${item.nomor_urut}
            ${escapeHtml(
              item.nama
            )}
          </div>

          <div class="bar-track">

            <div
              class="bar-fill"
              style="width:${percentage}%"
            ></div>

          </div>

          <div class="candidate-vote-count">
            ${formatNumber(
              item.suara
            )}
            suara
          </div>
        `;


      container.appendChild(
        row
      );

    }
  );

}


/* =====================================================
   RESULT CARDS
===================================================== */

function renderResults(
  results
) {

  const container =
    $("resultsContainer");


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  const data =
    normalizeResults(
      results
    );


  if (
    !data.length
  ) {

    container.innerHTML =
      `
        <div class="loading-box">
          Belum ada suara.
        </div>
      `;


    return;

  }


  const totalVotes =
    data.reduce(
      function (
        sum,
        item
      ) {

        return (
          sum +
          item.suara
        );

      },
      0
    );


  data.forEach(
    function (
      item,
      index
    ) {

      const percentage =
        totalVotes > 0
          ? (
              item.suara /
              totalVotes
            ) *
            100
          : 0;


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "result-card";


      card.innerHTML =
        `
          <div class="result-top">

            <div>

              <div class="result-name">
                ${index + 1}.
                ${escapeHtml(
                  item.nama
                )}
              </div>

              <div class="result-number">
                Nomor urut:
                ${item.nomor_urut}
              </div>

            </div>

            <div class="result-votes">
              ${formatNumber(
                item.suara
              )}
              suara
            </div>

          </div>

          <div class="progress">

            <div
              class="progress-bar"
              style="width:${percentage}%"
            ></div>

          </div>

          <div class="result-number">
            ${percentage.toFixed(2)}%
          </div>
        `;


      container.appendChild(
        card
      );

    }
  );

}


/* =====================================================
   LOAD LOGS
===================================================== */

async function loadLogs() {

  const tbody =
    $("logsTableBody");


  if (!tbody) {

    return;

  }


  tbody.innerHTML =
    `
      <tr>
        <td
          colspan="4"
          class="loading-cell"
        >
          Memuat log...
        </td>
      </tr>
    `;


  try {

    if (!adminToken) {

      throw new Error(
        "Sesi admin tidak tersedia."
      );

    }


    const result =
      await apiRequest(
        "admin_logs",
        {

          token:
            adminToken

        }
      );


    if (
      !result ||
      result.success !== true
    ) {

      throw new Error(
        result?.message ||
        "Gagal mengambil log."
      );

    }


    renderLogs(
      Array.isArray(
        result.logs
      )
        ? result.logs
        : []
    );


    return result.logs || [];

  } catch (error) {

    console.error(
      "LOG ERROR:",
      error
    );


    tbody.innerHTML =
      `
        <tr>
          <td
            colspan="4"
            class="loading-cell"
          >
            ${escapeHtml(
              error.message ||
              "Gagal mengambil log."
            )}
          </td>
        </tr>
      `;


    if (
      isAuthenticationError(
        error
      )
    ) {

      throw error;

    }


    return null;

  }

}


/* =====================================================
   RENDER LOGS
===================================================== */

function renderLogs(
  logs
) {

  const tbody =
    $("logsTableBody");


  if (!tbody) {

    return;

  }


  tbody.innerHTML =
    "";


  if (
    !Array.isArray(
      logs
    ) ||
    !logs.length
  ) {

    tbody.innerHTML =
      `
        <tr>
          <td
            colspan="4"
            class="loading-cell"
          >
            Belum ada aktivitas.
          </td>
        </tr>
      `;


    return;

  }


  logs.forEach(
    function (
      log
    ) {

      const tr =
        document.createElement(
          "tr"
        );


      tr.innerHTML =
        `
          <td>
            ${escapeHtml(
              formatDateTime(
                log.timestamp
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              log.aktivitas ||
              "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              log.id_pemilih ||
              "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              log.keterangan ||
              "-"
            )}
          </td>
        `;


      tbody.appendChild(
        tr
      );

    }
  );

}


/* =====================================================
   LOGOUT
===================================================== */

async function adminLogoutAction() {

  const token =
    adminToken;


  /*
   * Logout lokal segera.
   *
   * User tidak bisa lagi menggunakan dashboard
   * meskipun server sedang lambat.
   */

  forceLogout();


  if (!token) {

    return;

  }


  /*
   * Beritahu backend jika memungkinkan.
   */

  try {

    await apiRequest(
      "admin_logout",
      {

        token:
          token

      }

    );

  } catch (error) {

    console.warn(
      "ADMIN LOGOUT SERVER ERROR:",
      error
    );

  }

}


/* =====================================================
   FORCE LOGOUT
===================================================== */

function forceLogout() {

  /*
   * Hapus token utama.
   */

  localStorage.removeItem(
    "admin_token"
  );


  /*
   * Bersihkan kemungkinan token
   * dari versi lama.
   */

  sessionStorage.removeItem(
    "admin_token"
  );


  sessionStorage.removeItem(
    "evoting_admin_token"
  );


  adminToken =
    null;


  currentDashboard =
    null;


  currentVoters =
    [];


  isLoadingAllData =
    false;


  showLogin();


  if ($("password")) {

    $("password").value =
      "";

  }


  if ($("loginButton")) {

    $("loginButton").disabled =
      false;

    $("loginButton").textContent =
      "Login Admin";

  }

}


/* =====================================================
   TOAST
===================================================== */

function showToast(
  message
) {

  const toast =
    $("toast");


  if (!toast) {

    return;

  }


  toast.textContent =
    message || "";


  toast.classList.add(
    "show"
  );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      function () {

        toast.classList.remove(
          "show"
        );

      },
      3000
    );

}


/* =====================================================
   FORMAT NUMBER
===================================================== */

function formatNumber(
  value
) {

  const number =
    Number(
      value || 0
    );


  return number.toLocaleString(
    "id-ID"
  );

}


/* =====================================================
   FORMAT DATE
===================================================== */

function formatDateTime(
  value
) {

  if (!value) {

    return "-";

  }


  const date =
    new Date(
      value
    );


  if (
    isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );

  }


  return date.toLocaleString(
    "id-ID",
    {

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit"

    }
  );

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


/* =====================================================
   GLOBAL FUNCTION
===================================================== */

/*
 * Dipertahankan agar HTML lama yang menggunakan
 *
 * onclick="loadAllData(true)"
 *
 * tetap bekerja.
 */

window.loadAllData =
  loadAllData;


window.loadDashboard =
  loadDashboard;


window.loadVoters =
  loadVoters;


window.loadResults =
  loadResults;


window.loadLogs =
  loadLogs;


window.forceLogout =
  forceLogout;