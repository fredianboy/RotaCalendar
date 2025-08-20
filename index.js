const USERS = [
  // username, password, isAdmin, staffName, icsFile
  { username: "admin", password: "admin", isAdmin: true,  staffName: "",             icsFile: "" },
  { username: "Jaypee", password: "user1", isAdmin: true, staffName: "Jaypee",  icsFile: "jb.ics" },
  { username: "Mayena", password: "user2", isAdmin: false, staffName: "Mayena",    icsFile: "ma.ics" },
  { username: "Abdel", password: "user3", isAdmin: true, staffName: "Abdel",    icsFile: "aa.ics" },
  { username: "Chris", password: "user4", isAdmin: true, staffName: "Chris",    icsFile: "cb.ics" },
  { username: "Arvin", password: "user5", isAdmin: false, staffName: "Arvin",    icsFile: "ac.ics" },
  { username: "Dennis", password: "user6", isAdmin: false, staffName: "Dennis",    icsFile: "dc.ics" },
  { username: "Stacy", password: "user7", isAdmin: false, staffName: "Stacy",    icsFile: "sd.ics" },
  { username: "Fatima", password: "user8", isAdmin: false, staffName: "Fatima",    icsFile: "ff.ics" },
  { username: "Fred", password: "user9", isAdmin: true, staffName: "Fred",    icsFile: "fh.ics" },
  { username: "Erick", password: "user10", isAdmin: true, staffName: "Erick",    icsFile: "el.ics" },
  { username: "Trixielle", password: "user11", isAdmin: false, staffName: "Trixielle",    icsFile: "tlt.ics" },
  { username: "Grace", password: "user12", isAdmin: true, staffName: "Grace",    icsFile: "mgv.ics" },
  { username: "Jakki", password: "user13", isAdmin: false, staffName: "Jakki",    icsFile: "jy.ics" },
  { username: "Phillip", password: "manager", isAdmin: true, staffName: "Phillip",    icsFile: "pd.ics" },
  { username: "Jonathan", password: "user14", isAdmin: false, staffName: "Jonathan",    icsFile: "jm.ics" },
  { username: "Suresh", password: "user15", isAdmin: false, staffName: "Suresh",    icsFile: "sj.ics" },
  { username: "Alex", password: "user16", isAdmin: false, staffName: "Alex",    icsFile: "aw.ics" },
  { username: "Mustafa", password: "user17", isAdmin: false, staffName: "Mustafa",    icsFile: "mln.ics" },
  { username: "Dan", password: "user18", isAdmin: false, staffName: "Dan",    icsFile: "dw.ics" }
];

const SESSION_KEY = "rota.sessionUser";

// Cache DOM
const $user = document.getElementById("username");
const $pass = document.getElementById("password");
const $btn  = document.getElementById("loginBtn");
const $err  = document.getElementById("errorMsg");

function showError(msg) { if ($err) $err.textContent = msg || ""; }
function setBusy(isBusy) { if ($btn) $btn.disabled = isBusy; }

function setSessionUser(userObj) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(userObj));
  // keep this for backwards-compat if any old checks still use it
  sessionStorage.setItem("loggedInUser", userObj.username);
}

function login(e) {
  if (e) e.preventDefault();

  const username = ($user?.value || "").trim();
  const password = ($pass?.value || "");

  if (!username || !password) {
    showError("⚠️ Please enter both username and password.");
    ($user && !username ? $user : $pass)?.focus();
    return;
  }

  setBusy(true);
  showError("");

  setTimeout(() => {
    const match = USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (match) {
      setSessionUser({
        username: match.username,
        isAdmin: match.isAdmin,
        staffName: match.staffName,
        icsFile: match.icsFile
      });
      window.location.href = "home.html";
    } else {
      showError("❌ Invalid username or password.");
      if ($pass) { $pass.value = ""; $pass.focus(); }
    }

    setBusy(false);
  }, 0);
}

// Enter key + click handlers
[$user, $pass].forEach(el => {
  el?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") login(ev); });
  el?.addEventListener("input", () => showError(""));
});
$btn?.addEventListener("click", login);
