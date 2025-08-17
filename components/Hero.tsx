
import React from 'react';

const Hero: React.FC = () => {
  return (
    <section 
      id="home" 
      className="relative bg-cover bg-center h-[70vh] min-h-[500px] flex items-center" 
      style={{ backgroundImage: "url('https://picsum.photos/seed/energyai/1920/1080')" }}
    >
      <div className="absolute inset-0 bg-black/60"></div>
      <div className="relative container mx-auto px-6 text-white text-center">
        <h2 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4 tracking-tight">
          AI Transformation & Product Leadership
        </h2>
        <p className="text-lg md:text-xl max-w-3xl mx-auto text-gray-200">
          Driving innovation in the Energy and Engineering sectors with cutting-edge AI solutions and strategic product management.
        </p>
        <a href="#contact" className="mt-8 inline-block bg-brand-blue text-white font-bold py-3 px-8 rounded-lg hover:bg-opacity-90 transition-all duration-300 shadow-lg">
          Get in Touch
        </a>
      </div>
    </section>
  );
};

export default Hero;
