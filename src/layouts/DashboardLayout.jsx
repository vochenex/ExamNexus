import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "./ThemeContext";

export default function DashboardLayout() {
  const navigate = useNavigate();

const { theme, setTheme } = useTheme();
React.useEffect(() => {
  document.documentElement.classList.toggle(
    "light",
    theme === "light"
  );
}, [theme]);

  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("examnexus_user");
    navigate("/auth");
  };

  return (
    <div
      className={`
        min-h-screen
        flex
              ${theme === "dark"
        ? "bg-[#031d1f] text-white"
        : "bg-[#f4fbf9] text-gray-900"
      }
      `}
    >
      {/* SIDEBAR */}
      <aside
        className={`
          w-72
          p-5
          flex flex-col
          shrink-0
          backdrop-blur-xl
          ${theme === "dark"
            ? "bg-[#0b1114]/90 border-r border-[#10B981]/10"
            : `
    bg-white
    border-r border-emerald-100
  `
          }
          shadow-[0_0_80px_rgba(16,185,129,0.08)]
        `}
      >
        {/* LOGO */}
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              <img
                src="/favicon.svg"
                alt="ExamNexus logo"
                className="w-6 h-6 object-contain"
              />
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              ExamNexus
            </h1>
          </div>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-900"} text-xs mt-1`}>
            Intelligent Assessment Platform
          </p>
        </div>

        {/* NAVIGATION */}
        <nav className="space-y-2 mt-6">

          <NavLink
            to="/faculty/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2 p-3 rounded-xl transition ${
                isActive
                  ? theme === "dark"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25"
                    : `
                        bg-emerald-500
                        text-white
                        shadow-lg
                        shadow-emerald-500/20
                      `
                  : theme === "dark"
                  ? "hover:bg-white/10"
                  : `
                      hover:bg-emerald-50
                      hover:text-emerald-700
                    `
              }`
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/faculty/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 p-3 rounded-xl transition ${
                isActive
                  ? theme === "dark"
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25"
                    : `
                        bg-emerald-500
                        text-white
                        shadow-lg
                        shadow-emerald-500/20
                      `
                  : theme === "dark"
                  ? "hover:bg-white/10"
                  : `
                      hover:bg-emerald-50
                      hover:text-emerald-700
                    `
              }`
            }
          >
            <User size={18} />
            Profile
          </NavLink>

        </nav>

        {/* THEME TOGGLE */}
        <div className="mt-auto">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`
              w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
              ${theme === "dark"
                ? "bg-[#0b1114]/50 text-white border border-emerald-500/20 hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                : `
                    bg-white

                    text-gray-900

                    border border-emerald-200

                    hover:bg-emerald-50
                    hover:border-emerald-400

                    shadow-sm
                  `
              }
              transition-all
            `}
          >
            {theme === "dark" ? (
              <>
                <Sun size={18} />
                Light Mode
              </>
            ) : (
              <>
                <Moon size={18} />
                Dark Mode
              </>
            )}
          </button>
        </div>

        {/* USER INFO */}
        <div
          className={`
            pt-6 border-t
            ${theme === "dark" ? "border-white/10" : "border-emerald-300"}
          `}
        >
          <div className="mb-4 text-center">
            <p
  className={`
    font-semibold capitalize
    ${
      theme === "dark"
        ? "text-emerald-400"
        : "text-teal-700"
    }
  `}
>
  {user.role || "Faculty"}
</p>

</div>
          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center justify-center gap-2
              px-5 py-3 rounded-xl
              ${theme === "dark"
                ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-400 hover:text-red-300 hover:shadow-[0_0_25px_rgba(239,68,68,0.25)]"
                : `
                  bg-white

                  border border-red-200

                  text-red-600

                  hover:bg-red-50
                  hover:border-red-400

                  shadow-sm
                `
              }
              font-medium transition-all duration-300
            `}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main
        className={`
          flex-1
          p-8
          overflow-y-auto
          relative

          ${
            theme === "dark"
              ? "text-white"
              : "text-slate-900"
          }
        `}
      >
        <Outlet />
      </main>
    </div>
  );
}