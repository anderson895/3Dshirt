import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Landing() {
  const nav = useNavigate()

  return (
    <section 
      className="flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 lg:px-8 relative" 
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Text and Content Container */}
      <div className="space-y-4 sm:space-y-6 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl text-white z-10">
        {/* Animated Title */}
        <motion.h1 
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-yellow-500 leading-tight"
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          The Future of T-Shirt Design is Here
        </motion.h1>

        {/* Animated Description */}
        <motion.p 
          className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-200 leading-relaxed"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
        >
          Customize your mannequin's body and t-shirt design in real-time. 
          Visualize your creations in 3D and take your fashion design skills to the next level.
        </motion.p>

        <motion.p 
          className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1, ease: "easeOut" }}
        >
          Adjust every detail, from body shape to fabric design, and see how your custom shirt fits your mannequin.
        </motion.p>

        {/* Animated Button */}
        <motion.button
          onClick={() => nav('/customize')}
          className="px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4 mt-4 sm:mt-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-sm sm:text-base md:text-lg lg:text-xl font-semibold shadow-xl hover:scale-105 transform transition w-full sm:w-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1, ease: "easeOut" }}
        >
          Start Designing
        </motion.button>
      </div>

      {/* Futuristic background effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-800 to-blue-500 opacity-60"></div>
      <div className="absolute inset-0 bg-white opacity-10 rounded-lg blur-xl"></div>
    </section>
  )
}
