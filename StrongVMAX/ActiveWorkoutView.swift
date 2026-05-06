//
//  ActiveWorkoutView.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData
 
struct ActiveWorkoutView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    
    let template: WorkoutTemplate
    
    @State private var session: WorkoutSession?
    @State private var exerciseLogs: [ExerciseLog] = []
    @State private var elapsedSeconds = 0
    @State private var timer: Timer?
    @State private var restingExerciseIndex: Int? = nil
    @State private var restRemaining: Int = 0
    @State private var restTimer: Timer?
    @State private var showFinishAlert = false
    @State private var showCancelAlert = false
    @State private var selectedExerciseLog: ExerciseLog? = nil
    @State private var showExercisePicker = false
    @State private var didSetup = false  // guard contro doppio onAppear
    
    var totalVolume: Double {
        exerciseLogs.reduce(0) { $0 + $1.totalVolume }
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                headerBar
                
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(Array(exerciseLogs.enumerated()), id: \.element.id) { index, log in
                            ExerciseCard(
                                log: log,
                                previousLog: previousLog(for: log),
                                isResting: restingExerciseIndex == index,
                                restRemaining: restRemaining,
                                onSetCompleted: { handleSetCompleted(exerciseIndex: index, log: log) },
                                onSkipRest: { stopRestTimer() },
                                onNameTap: { selectedExerciseLog = log }
                            )
                        }
                        
                        Button {
                            showExercisePicker = true
                        } label: {
                            Label("Aggiungi esercizio", systemImage: "plus.circle.fill")
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                    }
                    .padding(12)
                }
            }
            .navigationTitle(template.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { showCancelAlert = true }
                        .foregroundStyle(.secondary)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Fine") { showFinishAlert = true }
                        .foregroundStyle(.red)
                        .fontWeight(.semibold)
                }
            }
            .onAppear {
                guard !didSetup else { return }
                didSetup = true
                setupSession()
            }
            .onDisappear { stopAllTimers() }
            // Salva
            .alert("Termina allenamento?", isPresented: $showFinishAlert) {
                Button("Salva") { saveSession() }
                Button("Continua", role: .cancel) { }
            } message: {
                Text("Durata: \(formatTime(elapsedSeconds)) · Volume: \(Int(totalVolume)) kg")
            }
            // Annulla — elimina la sessione dal context
            .alert("Annullare l'allenamento?", isPresented: $showCancelAlert) {
                Button("Annulla allenamento", role: .destructive) { cancelSession() }
                Button("Continua", role: .cancel) { }
            } message: {
                Text("I dati di questa sessione non verranno salvati.")
            }
            .sheet(item: $selectedExerciseLog) { log in
                ExerciseDetailSheet(exerciseID: log.exerciseID, exerciseName: log.exerciseName)
            }
            .sheet(isPresented: $showExercisePicker) {
                ExercisePickerForWorkout { selected in
                    addExerciseDuringWorkout(selected)
                }
            }
        }
    }
    
    // MARK: - Header
    
    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("durata")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(formatTime(elapsedSeconds))
                    .font(.system(.title2, design: .monospaced).weight(.bold))
                    .foregroundStyle(.orange)
                    .contentTransition(.numericText())
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("volume totale")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("\(Int(totalVolume)) kg")
                    .font(.headline)
                    .foregroundStyle(.green)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemBackground))
    }
    
    // MARK: - Setup
    
    private func setupSession() {
        let newSession = WorkoutSession(templateID: template.id, templateName: template.name)
        context.insert(newSession)
        session = newSession
        
        let sorted = template.templateExercises.sorted { $0.order < $1.order }
        for (i, te) in sorted.enumerated() {
            let log = ExerciseLog(
                exerciseName: te.exerciseName,
                exerciseID: te.exerciseID,
                restSeconds: te.defaultRestSeconds,
                order: i
            )
            context.insert(log)
            
            for j in 0..<te.defaultSets {
                let set = WorkoutSet(weight: te.defaultWeight, reps: te.defaultReps, order: j)
                context.insert(set)
                log.sets.append(set)
            }
            newSession.exercises.append(log)
            exerciseLogs.append(log)
        }
        
        startWorkoutTimer()
    }
    
    // MARK: - Aggiungi esercizio durante workout
    
    private func addExerciseDuringWorkout(_ exercise: Exercise) {
        guard let s = session else { return }
        let log = ExerciseLog(
            exerciseName: exercise.name,
            exerciseID: exercise.id,
            restSeconds: 90,
            order: exerciseLogs.count
        )
        context.insert(log)
        let set = WorkoutSet(order: 0)
        context.insert(set)
        log.sets.append(set)
        s.exercises.append(log)
        exerciseLogs.append(log)
    }
    
    // MARK: - Rest Timer
    
    private func handleSetCompleted(exerciseIndex: Int, log: ExerciseLog) {
        stopRestTimer()
        restingExerciseIndex = exerciseIndex
        restRemaining = log.restSeconds
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if restRemaining > 0 {
                restRemaining -= 1
            } else {
                stopRestTimer()
            }
        }
    }
    
    private func stopRestTimer() {
        restTimer?.invalidate()
        restTimer = nil
        restingExerciseIndex = nil
        restRemaining = 0
    }
    
    // MARK: - Workout Timer
    
    private func startWorkoutTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsedSeconds += 1
        }
    }
    
    private func stopAllTimers() {
        timer?.invalidate()
        timer = nil
        restTimer?.invalidate()
        restTimer = nil
    }
    
    // MARK: - Save / Cancel
    
    private func saveSession() {
        stopAllTimers()
        session?.durationSeconds = elapsedSeconds
        try? context.save()
        dismiss()
    }
    
    private func cancelSession() {
        stopAllTimers()
        if let s = session {
            context.delete(s)
            try? context.save()
        }
        dismiss()
    }
    
    // MARK: - Previous log (colonna "prec.")
    
    private func previousLog(for log: ExerciseLog) -> ExerciseLog? {
        let descriptor = FetchDescriptor<WorkoutSession>(
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )
        guard let sessions = try? context.fetch(descriptor) else { return nil }
        let currentSessionID = session?.id
        return sessions
            .first {
                $0.id != currentSessionID &&
                $0.exercises.contains { $0.exerciseID == log.exerciseID }
            }?
            .exercises
            .first { $0.exerciseID == log.exerciseID }
    }
    
    private func formatTime(_ s: Int) -> String {
        String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
   
    }
 
