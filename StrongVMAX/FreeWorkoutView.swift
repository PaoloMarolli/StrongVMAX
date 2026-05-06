//
//  FreeWorkoutView.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 06/05/26.
//
import SwiftUI
import SwiftData

struct FreeWorkoutView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var exerciseLogs: [ExerciseLog] = []
    @State private var session: WorkoutSession?
    @State private var elapsedSeconds = 0
    @State private var timer: Timer?
    @State private var restingExerciseIndex: Int? = nil
    @State private var restRemaining: Int = 0
    @State private var restTimer: Timer?
    @State private var showFinishAlert = false
    @State private var showCancelAlert = false
    @State private var showExercisePicker = false
    @State private var didSetup = false

    var totalVolume: Double {
        exerciseLogs.reduce(0) { $0 + $1.totalVolume }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("durata")
                            .font(.caption2).foregroundStyle(.secondary)
                        Text(formatTime(elapsedSeconds))
                            .font(.system(.title2, design: .monospaced).weight(.bold))
                            .foregroundStyle(.orange)
                            .contentTransition(.numericText())
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("volume totale")
                            .font(.caption2).foregroundStyle(.secondary)
                        Text("\(Int(totalVolume)) kg")
                            .font(.headline).foregroundStyle(.green)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color(.secondarySystemBackground))

                if exerciseLogs.isEmpty {
                    // Empty state
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "plus.circle")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("Aggiungi il primo esercizio")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                        Button {
                            showExercisePicker = true
                        } label: {
                            Label("Aggiungi esercizio", systemImage: "plus.circle.fill")
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(.borderedProminent)
                        Spacer()
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(Array(exerciseLogs.enumerated()), id: \.element.id) { index, log in
                                let isResting = restingExerciseIndex == index
                                let onCompleted = { handleSetCompleted(exerciseIndex: index, log: log) }
                                let onSkip = { stopRestTimer() }

                                ExerciseCard(
                                    log: log,
                                    previousLog: nil,
                                    isResting: isResting,
                                    restRemaining: restRemaining,
                                    onSetCompleted: onCompleted,
                                    onSkipRest: onSkip,
                                    onNameTap: { }
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
            }
            .navigationTitle("Workout libero")
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
                        .disabled(exerciseLogs.isEmpty)
                }
            }
            .onAppear {
                guard !didSetup else { return }
                didSetup = true
                startWorkoutTimer()
                let s = WorkoutSession(templateID: UUID(), templateName: "Workout libero")
                context.insert(s)
                session = s
            }
            .onDisappear { stopAllTimers() }
            .alert("Termina allenamento?", isPresented: $showFinishAlert) {
                Button("Salva") { saveSession() }
                Button("Continua", role: .cancel) { }
            } message: {
                Text("Durata: \(formatTime(elapsedSeconds)) · Volume: \(Int(totalVolume)) kg")
            }
            .alert("Annullare?", isPresented: $showCancelAlert) {
                Button("Annulla allenamento", role: .destructive) { cancelSession() }
                Button("Continua", role: .cancel) { }
            } message: {
                Text("I dati non verranno salvati.")
            }
            .sheet(isPresented: $showExercisePicker) {
                ExercisePickerForWorkout { selected in
                    addExercise(selected)
                }
            }
        }
    }

    private func addExercise(_ exercise: Exercise) {
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
        session?.exercises.append(log)
        exerciseLogs.append(log)
    }

    private func handleSetCompleted(exerciseIndex: Int, log: ExerciseLog) {
        stopRestTimer()
        restingExerciseIndex = exerciseIndex
        restRemaining = log.restSeconds
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if restRemaining > 0 { restRemaining -= 1 } else { stopRestTimer() }
        }
    }

    private func stopRestTimer() {
        restTimer?.invalidate(); restTimer = nil
        restingExerciseIndex = nil; restRemaining = 0
    }

    private func startWorkoutTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsedSeconds += 1
        }
    }

    private func stopAllTimers() {
        timer?.invalidate(); timer = nil
        restTimer?.invalidate(); restTimer = nil
    }

    private func saveSession() {
        stopAllTimers()
        session?.durationSeconds = elapsedSeconds
        try? context.save()
        dismiss()
    }

    private func cancelSession() {
        stopAllTimers()
        if let s = session { context.delete(s); try? context.save() }
        dismiss()
    }

    private func formatTime(_ s: Int) -> String {
        String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}
