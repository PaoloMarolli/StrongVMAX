//
//  SeedData.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import Foundation
import SwiftData

enum SeedData {
    static func seedIfNeeded(container: ModelContainer) {
        let context = container.mainContext
        let descriptor = FetchDescriptor<Exercise>()
        guard (try? context.fetch(descriptor))?.isEmpty == true else { return }

        let exercises: [(String, String, String)] = [
            ("Panca piana", "Petto", "Bilanciere"),
            ("Panca inclinata", "Petto", "Bilanciere"),
            ("Croci cavi", "Petto", "Cavi"),
            ("Shoulder press", "Spalle", "Bilanciere"),
            ("Alzate laterali", "Spalle", "Manubri"),
            ("Trazioni", "Schiena", "Corpo libero"),
            ("Rematore bilanciere", "Schiena", "Bilanciere"),
            ("Lat machine", "Schiena", "Macchina"),
            ("Squat", "Gambe", "Bilanciere"),
            ("Leg press", "Gambe", "Macchina"),
            ("Romanian deadlift", "Gambe", "Bilanciere"),
            ("Curl bilanciere", "Bicipiti", "Bilanciere"),
            ("Tricep pushdown", "Tricipiti", "Cavi"),
            ("Plank", "Core", "Corpo libero"),
        ]

        var exerciseMap: [String: Exercise] = [:]
        for (name, muscle, equipment) in exercises {
            let ex = Exercise(name: name, muscleGroup: muscle, equipment: equipment)
            context.insert(ex)
            exerciseMap[name] = ex
        }

        // Push Day A
        let push = WorkoutTemplate(name: "Push Day A", order: 0)
        context.insert(push)
        for (i, name) in ["Panca piana", "Shoulder press", "Tricep pushdown"].enumerated() {
            if let ex = exerciseMap[name] {
                let te = TemplateExercise(exerciseID: ex.id, exerciseName: name,
                                         defaultSets: 3, defaultReps: 8,
                                         defaultRestSeconds: 90, order: i)
                context.insert(te)
                push.templateExercises.append(te)
            }
        }

        // Pull Day B
        let pull = WorkoutTemplate(name: "Pull Day B", order: 1)
        context.insert(pull)
        for (i, name) in ["Trazioni", "Rematore bilanciere", "Curl bilanciere"].enumerated() {
            if let ex = exerciseMap[name] {
                let te = TemplateExercise(exerciseID: ex.id, exerciseName: name,
                                         defaultSets: 3, defaultReps: 8,
                                         defaultRestSeconds: 90, order: i)
                context.insert(te)
                pull.templateExercises.append(te)
            }
        }

        // Leg Day C
        let legs = WorkoutTemplate(name: "Leg Day C", order: 2)
        context.insert(legs)
        for (i, name) in ["Squat", "Leg press", "Romanian deadlift"].enumerated() {
            if let ex = exerciseMap[name] {
                let te = TemplateExercise(exerciseID: ex.id, exerciseName: name,
                                         defaultSets: 4, defaultReps: 8,
                                         defaultRestSeconds: 120, order: i)
                context.insert(te)
                legs.templateExercises.append(te)
            }
        }

        try? context.save()
    }
}
