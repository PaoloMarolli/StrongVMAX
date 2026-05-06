//
//  StrongVMAX.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData

@main
struct StrongVMAX: App {
    let container: ModelContainer

    init() {
        let schema = Schema([
            WorkoutTemplate.self,
            TemplateExercise.self,
            Exercise.self,
            WorkoutSession.self,
            ExerciseLog.self,
            WorkoutSet.self,
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            container = try ModelContainer(for: schema, configurations: config)
        } catch {
            fatalError("SwiftData init failed: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(container)
                .onAppear {
                    SeedData.seedIfNeeded(container: container)
                }
        }
    }
}

struct ContentView: View {
    var body: some View {
        TabView {
            WorkoutListView()
                .tabItem { Label("Routine", systemImage: "list.bullet.clipboard.fill") }
            HistoryView()
                .tabItem { Label("Storico", systemImage: "clock.arrow.circlepath") }
            ExerciseCatalogView()
                .tabItem { Label("Esercizi", systemImage: "dumbbell.fill") }
        }
    }
}
