import { Search, Plus } from "lucide-react";

export default function ExercisesPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex flex-col p-4 border-b border-border bg-card sticky top-0 z-10 gap-3">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Esercizi</h1>
          <button className="p-2 text-primary" aria-label="Nuovo esercizio">
            <Plus size={24} />
          </button>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Cerca esercizio..." 
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-gray-50 dark:bg-[#1a1a1a] text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto">
        {/* Placeholder List */}
        
        <div className="border-b border-border">
          <div className="bg-gray-50 dark:bg-[#111] px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
            Petto
          </div>
          <div className="px-4 py-3 border-b border-border/50 active:bg-gray-50 dark:active:bg-[#222] cursor-pointer">
            <h3 className="font-medium">Panca piana</h3>
            <p className="text-xs text-gray-500 mt-0.5">Bilanciere</p>
          </div>
          <div className="px-4 py-3 border-b border-border/50 active:bg-gray-50 dark:active:bg-[#222] cursor-pointer">
            <h3 className="font-medium">Panca inclinata</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manubri</p>
          </div>
          <div className="px-4 py-3 active:bg-gray-50 dark:active:bg-[#222] cursor-pointer">
            <h3 className="font-medium">Croci cavi</h3>
            <p className="text-xs text-gray-500 mt-0.5">Cavi</p>
          </div>
        </div>

        <div className="border-b border-border">
          <div className="bg-gray-50 dark:bg-[#111] px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
            Spalle
          </div>
          <div className="px-4 py-3 border-b border-border/50 active:bg-gray-50 dark:active:bg-[#222] cursor-pointer">
            <h3 className="font-medium">Shoulder press</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manubri</p>
          </div>
          <div className="px-4 py-3 active:bg-gray-50 dark:active:bg-[#222] cursor-pointer">
            <h3 className="font-medium">Alzate laterali</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manubri</p>
          </div>
        </div>
        
      </div>
    </div>
  );
}
