import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import Landing from "./pages/Landing";
import Customize from "./pages/Customize";
import Design from "./pages/Design";
import Preview from "./pages/Preview";
import Review from "./pages/Review";
import ExportPage from "./pages/ExportPage";

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen w-screen">
      {/* Conditionally render the header only if the current path is "/" */}
      {location.pathname === "/" && (
        <header className="p-3 flex items-center justify-between bg-transparent fixed top-0 left-0 right-0 z-50 to-blue-500">
          {/* Logo Section */}
          <NavLink to="/" className="flex items-center gap-1">
            <img
              src="/logo.webp" // Path to your logo image
              alt="3D Shirt Designer Logo"
              className="h-16" // Adjust size as necessary
            />
            <span className="font-semibold text-white text-2xl">3D Shirt Designer</span>
          </NavLink>

          {/* Navigation Links */}
          <nav className="flex gap-6 text-white text-lg pr-8">
            <NavLink
              to="/customize"
              className={({ isActive }) =>
                isActive
                  ? "text-yellow-500 font-bold transform scale-105 transition-all duration-300"
                  : "hover:text-yellow-300 hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Customize
            </NavLink>
            <NavLink
              to="/design"
              className={({ isActive }) =>
                isActive
                  ? "text-yellow-500 font-bold transform scale-105 transition-all duration-300"
                  : "hover:text-yellow-300 hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Design
            </NavLink>
            <NavLink
              to="/preview"
              className={({ isActive }) =>
                isActive
                  ? "text-yellow-500 font-bold transform scale-105 transition-all duration-300"
                  : "hover:text-yellow-300 hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Preview
            </NavLink>
            <NavLink
              to="/export"
              className={({ isActive }) =>
                isActive
                  ? "text-yellow-500 font-bold transform scale-105 transition-all duration-300"
                  : "hover:text-yellow-300 hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Export
            </NavLink>
          </nav>
        </header>
      )}
      
      <main className="w-full h-screen">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/customize" element={<Customize />} />
          <Route path="/design" element={<Design />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/review" element={<Review />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
