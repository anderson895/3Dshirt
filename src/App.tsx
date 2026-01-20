import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Customize from "./pages/Customize";
import Design from "./pages/Design";
import Preview from "./pages/Preview";
import Review from "./pages/Review";
import ExportPage from "./pages/ExportPage";
import SignInPage from "./pages/SignInPage";
import SharedDesignView from "./pages/SharedDesignView";
import Gallery from "./components/Gallery/Gallery";
import UserMenu from "./components/Header/UserMenu";

function App() {
  const location = useLocation();
  const showHeader = location.pathname === "/" || location.pathname.startsWith("/customize")
  const isHome = location.pathname === "/"
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Light text on home or when scrolled (blue header), dark otherwise
  const lightHeader = isHome || isScrolled

  return (
    <div className="min-h-screen w-screen">
      {/* Render the header on home and customize pages */}
      {showHeader && (
        <header className={`p-3 flex items-center justify-between fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-blue-600/90 backdrop-blur-md shadow-lg' 
            : isHome 
              ? 'bg-blue-600/90 backdrop-blur-md shadow-lg' 
              : 'bg-white/90 backdrop-blur-md shadow-sm'
        }`}>
          {/* Logo Section */}
          <NavLink to="/" className="flex items-center gap-1">
            <img
              src="/logo.webp" // Path to your logo image
              alt="3D Shirt Designer Logo"
              className="h-16" // Adjust size as necessary
            />
            <span className={`font-semibold ${lightHeader ? 'text-white' : 'text-slate-900'} text-2xl`}>3D Shirt Designer</span>
          </NavLink>

          {/* Navigation Links */}
          <nav className={`flex gap-6 items-center ${lightHeader ? 'text-white' : 'text-slate-900'} text-lg pr-8`}>
            <NavLink
              to="/customize"
              className={({ isActive }) =>
                isActive
                  ? (lightHeader ? "text-yellow-300" : "text-blue-600") +
                    " font-bold transform scale-105 transition-all duration-300"
                  : (lightHeader ? "hover:text-yellow-300" : "hover:text-blue-600") +
                    " hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Customize
            </NavLink>
            <NavLink
              to="/design"
              className={({ isActive }) =>
                isActive
                  ? (lightHeader ? "text-yellow-300" : "text-blue-600") +
                    " font-bold transform scale-105 transition-all duration-300"
                  : (lightHeader ? "hover:text-yellow-300" : "hover:text-blue-600") +
                    " hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Design
            </NavLink>
            <NavLink
              to="/preview"
              className={({ isActive }) =>
                isActive
                  ? (lightHeader ? "text-yellow-300" : "text-blue-600") +
                    " font-bold transform scale-105 transition-all duration-300"
                  : (lightHeader ? "hover:text-yellow-300" : "hover:text-blue-600") +
                    " hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Preview
            </NavLink>
            <NavLink
              to="/export"
              className={({ isActive }) =>
                isActive
                  ? (lightHeader ? "text-yellow-300" : "text-blue-600") +
                    " font-bold transform scale-105 transition-all duration-300"
                  : (lightHeader ? "hover:text-yellow-300" : "hover:text-blue-600") +
                    " hover:scale-105 hover:underline transition-all duration-300"
              }
            >
              Export
            </NavLink>
            {/* User Menu / Sign In Button */}
            <div className="ml-4">
              <UserMenu variant={lightHeader ? 'light' : 'dark'} />
            </div>
          </nav>
        </header>
      )}
      
      <main className={`w-full h-screen ${showHeader ? 'pt-20' : ''}`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/shared/:shareToken" element={<SharedDesignView />} />
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
