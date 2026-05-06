//
//  Models.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import Foundation
import SwiftData
 
// MARK: - Set Type
 
enum SetType: String, Codable, CaseIterable {
    case normal  = "N"
    case warmup  = "W"
    case dropset = "D"
    case failure = "F"
 
    var label: String { rawValue }
 
    var countsInVolume: Bool { self != .warmup }
}
 
// MARK: - WorkoutSet
 
@Model
final class WorkoutSet {
    var id: UUID = UUID()
    var weight: Double = 0.0
    var reps: Int = 0
    var type: SetType = SetType.normal
    var isCompleted: Bool = false
    var order: Int = 0
 
    init(weight: Double = 0, reps: Int = 0, type: SetType = .normal, order: Int = 0) {
        self.id = UUID()
        self.weight = weight
        self.reps = reps
        self.type = type
        self.isCompleted = false
        self.order = order
    }
 
    // Epley: weight × (1 + reps/30)
    var theoreticalOneRM: Double {
        guard reps > 0, weight > 0 else { return 0 }
        if reps == 1 { return weight }
        return weight * (1 + Double(reps) / 30.0)
    }
 
    var volume: Double {
        guard isCompleted, type.countsInVolume else { return 0 }
        return weight * Double(reps)
    }
}
 
// MARK: - ExerciseLog
 
@Model
final class ExerciseLog {
    var id: UUID = UUID()
    var exerciseName: String = ""
    var exerciseID: UUID = UUID()
    var restSeconds: Int = 90
    var order: Int = 0
 
    @Relationship(deleteRule: .cascade)
    var sets: [WorkoutSet] = []
 
    init(exerciseName: String, exerciseID: UUID, restSeconds: Int = 90, order: Int = 0) {
        self.id = UUID()
        self.exerciseName = exerciseName
        self.exerciseID = exerciseID
        self.restSeconds = restSeconds
        self.order = order
    }
 
    var sortedSets: [WorkoutSet] {
        sets.sorted { $0.order < $1.order }
    }
 
    var totalVolume: Double {
        sets.reduce(0) { $0 + $1.volume }
    }
 
    var topSet: WorkoutSet? {
        sets
            .filter { $0.isCompleted && $0.type.countsInVolume }
            .max { $0.theoreticalOneRM < $1.theoreticalOneRM }
    }
 
    var sessionOneRM: Double {
        topSet?.theoreticalOneRM ?? 0
    }
}
 
// MARK: - WorkoutSession
 
@Model
final class WorkoutSession {
    var id: UUID = UUID()
    var templateID: UUID = UUID()
    var templateName: String = ""
    var date: Date = Date()
    var durationSeconds: Int = 0
 
    @Relationship(deleteRule: .cascade)
    var exercises: [ExerciseLog] = []
 
    init(templateID: UUID, templateName: String) {
        self.id = UUID()
        self.templateID = templateID
        self.templateName = templateName
        self.date = Date()
        self.durationSeconds = 0
    }
 
    var totalVolume: Double {
        exercises.reduce(0) { $0 + $1.totalVolume }
    }
 
    var formattedDuration: String {
        let h = durationSeconds / 3600
        let m = (durationSeconds % 3600) / 60
        return h > 0 ? "\(h)h \(m)min" : "\(m)min"
    }
}
 
// MARK: - Exercise (catalogo)
 
@Model
final class Exercise {
    var id: UUID = UUID()
    var name: String = ""
    var muscleGroup: String = ""
    var equipment: String = ""
    var isCustom: Bool = false
 
    init(name: String, muscleGroup: String = "", equipment: String = "", isCustom: Bool = false) {
        self.id = UUID()
        self.name = name
        self.muscleGroup = muscleGroup
        self.equipment = equipment
        self.isCustom = isCustom
    }
}
 
// MARK: - WorkoutTemplate
 
@Model
final class WorkoutTemplate {
    var id: UUID = UUID()
    var name: String = ""
    var order: Int = 0
    var isCustom: Bool = false
 
    @Relationship(deleteRule: .cascade)
    var templateExercises: [TemplateExercise] = []
 
    init(name: String, order: Int = 0, isCustom: Bool = false) {
        self.id = UUID()
        self.name = name
        self.order = order
        self.isCustom = isCustom
    }
}
 
// MARK: - TemplateExercise
 
@Model
final class TemplateExercise {
    var id: UUID = UUID()
    var exerciseID: UUID = UUID()
    var exerciseName: String = ""
    var defaultSets: Int = 3
    var defaultReps: Int = 8
    var defaultWeight: Double = 0.0
    var defaultRestSeconds: Int = 90
    var order: Int = 0
 
    init(exerciseID: UUID, exerciseName: String, defaultSets: Int = 3,
         defaultReps: Int = 8, defaultWeight: Double = 0,
         defaultRestSeconds: Int = 90, order: Int = 0) {
        self.id = UUID()
        self.exerciseID = exerciseID
        self.exerciseName = exerciseName
        self.defaultSets = defaultSets
        self.defaultReps = defaultReps
        self.defaultWeight = defaultWeight
        self.defaultRestSeconds = defaultRestSeconds
        self.order = order
    }
}
 

