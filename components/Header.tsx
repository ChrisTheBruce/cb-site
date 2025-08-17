
import React, { useState, useEffect } from 'react';

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#about', label: 'About' },
    { href: '#experience', label: 'Experience' },
    { href: '#downloads', label: 'Resources' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 shadow-md backdrop-blur-sm' : 'bg-transparent'}`}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <a href="#" className="flex items-center">
            <div className="border-2 border-brand-blue px-4 py-1">
              <h1 className="text-2xl md:text-3xl font-black italic text-brand-blue tracking-tight">
                Chris Brighouse
              </h1>
            </div>
          </a>
          <nav className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-gray-700 hover:text-brand-blue font-semibold transition-colors duration-200">
                {link.label}
              </a>
            ))}
          </nav>
          {/* Mobile menu could be added here if needed */}
        </div>
      </div>
    </header>
  );
};

export default Header;
