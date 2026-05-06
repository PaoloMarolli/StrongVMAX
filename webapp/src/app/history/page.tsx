export default function HistoryPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex justify-between items-center p-4 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-2xl font-bold">Storico</h1>
      </header>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-6">
          
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Questa settimana</h3>
            <div className="space-y-3">
              {/* Placeholder Session Card */}
              <div className="bg-card border border-border p-4 rounded-xl shadow-sm active:scale-95 transition-transform cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="font-semibold text-lg">Push Day</h2>
                  <span className="text-xs bg-gray-100 dark:bg-[#333333] px-2 py-1 rounded text-gray-600 dark:text-gray-300">Oggi</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">1h 15m</span>
                    <span className="text-xs">Durata</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">12,400 kg</span>
                    <span className="text-xs">Volume</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">6</span>
                    <span className="text-xs">Esercizi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Settimana scorsa</h3>
            <div className="space-y-3">
              <div className="bg-card border border-border p-4 rounded-xl shadow-sm active:scale-95 transition-transform cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="font-semibold text-lg">Pull Day</h2>
                  <span className="text-xs bg-gray-100 dark:bg-[#333333] px-2 py-1 rounded text-gray-600 dark:text-gray-300">14 Mag</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">1h 05m</span>
                    <span className="text-xs">Durata</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">10,200 kg</span>
                    <span className="text-xs">Volume</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">5</span>
                    <span className="text-xs">Esercizi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
