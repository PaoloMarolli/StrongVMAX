//
//  ExerciseCard.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData
 
struct ExerciseCard: View {
    @Environment(\.modelContext) private var context
 
    @Bindable var log: ExerciseLog
    let previousLog: ExerciseLog?   // log della sessione precedente per questo esercizio
    let isResting: Bool
    let restRemaining: Int
    let onSetCompleted: () -> Void
    let onSkipRest: () -> Void
    let onNameTap: () -> Void
 
    @State private var showRestPicker = false
 
    private var deltaPercent: Double? {
        guard let prev = previousLog, prev.totalVolume > 0 else { return nil }
        return ((log.totalVolume - prev.totalVolume) / prev.totalVolume) * 100
    }
 
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
 
            // Header
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Button(action: onNameTap) {
                        Text(log.exerciseName)
                            .font(.headline)
                            .foregroundStyle(.primary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(Int(log.totalVolume)) kg")
                        .font(.subheadline.weight(.semibold))
                    if let delta = deltaPercent {
                        DeltaBadge(percent: delta)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 8)
 
            // Rest timer bar
            if isResting {
                RestBar(remaining: restRemaining, total: log.restSeconds, onSkip: onSkipRest)
            }
 
            // Sets table
            VStack(spacing: 0) {
                SetTableHeader()
                    .padding(.horizontal, 14)
 
                ForEach(Array(log.sortedSets.enumerated()), id: \.element.id) { index, set in
                    SetRowView(
                        set: set,
                        index: index,
                        previousSet: previousLog?.sortedSets.indices.contains(index) == true
                            ? previousLog?.sortedSets[index]
                            : nil,
                        onComplete: {
                            if !set.isCompleted {
                                set.isCompleted = true
                                try? context.save()
                                onSetCompleted()
                            } else {
                                set.isCompleted = false
                                try? context.save()
                            }
                        }
                    )
                    .padding(.horizontal, 14)
                }
            }
            .padding(.bottom, 4)
 
            // Footer
            HStack {
                Button {
                    showRestPicker = true
                } label: {
                    Label("\(log.restSeconds) sec", systemImage: "timer")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
 
                Spacer()
 
                Button {
                    let next = WorkoutSet(order: log.sets.count)
                    context.insert(next)
                    log.sets.append(next)
                    try? context.save()
                } label: {
                    Label("Serie", systemImage: "plus.circle.fill")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.blue)
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 12)
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showRestPicker) {
            RestPickerSheet(seconds: $log.restSeconds)
                .presentationDetents([.height(280)])
        }
    }
}
 
// MARK: - SetTableHeader
 
struct SetTableHeader: View {
    var body: some View {
        HStack {
            Text("#").frame(width: 28, alignment: .leading)
            Text("prec.").frame(maxWidth: .infinity)
            Text("kg").frame(width: 64)
            Text("reps").frame(width: 52)
            Spacer().frame(width: 32)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.vertical, 4)
        Divider()
    }
}
 
// MARK: - SetRowView
 
struct SetRowView: View {
    @Environment(\.modelContext) private var context
    @Bindable var set: WorkoutSet
    let index: Int
    let previousSet: WorkoutSet?
    let onComplete: () -> Void
 
    @State private var showTypePicker = false
 
    var body: some View {
        HStack(spacing: 6) {
 
            // # button con tipo
            Button {
                showTypePicker = true
            } label: {
                Text(set.type == .normal ? "\(index + 1)" : set.type.label)
                    .font(.caption.weight(.bold))
                    .frame(width: 28, height: 26)
                    .background(typeColor.opacity(0.18))
                    .foregroundStyle(typeColor)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .confirmationDialog("Tipo di serie", isPresented: $showTypePicker, titleVisibility: .visible) {
                ForEach(SetType.allCases, id: \.self) { t in
                    Button(typeDescription(t)) {
                        set.type = t
                        try? context.save()
                    }
                }
                Button("Annulla", role: .cancel) { }
            }
 
            // Precedente
            Text(previousLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
 
            // Peso
            TextField("kg", value: $set.weight, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.center)
                .frame(width: 64)
                .padding(.vertical, 5)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .font(.subheadline)
 
            // Reps
            TextField("reps", value: $set.reps, format: .number)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .frame(width: 52)
                .padding(.vertical, 5)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .font(.subheadline)
 
            // Checkmark
            Button(action: onComplete) {
                Image(systemName: set.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(set.isCompleted ? .green : Color(.tertiaryLabel))
            }
            .frame(width: 32)
        }
        .padding(.vertical, 6)
        .opacity(set.isCompleted ? 0.65 : 1)
        Divider().padding(.leading, 34)
    }
 
    private var previousLabel: String {
        guard let prev = previousSet, prev.weight > 0 || prev.reps > 0 else { return "—" }
        return "\(Int(prev.weight))kg×\(prev.reps)"
    }
 
    private var typeColor: Color {
        switch set.type {
        case .normal:  return Color(.secondaryLabel)
        case .warmup:  return .orange
        case .dropset: return .purple
        case .failure: return .red
        }
    }
 
    private func typeDescription(_ t: SetType) -> String {
        switch t {
        case .normal:  return "Normale"
        case .warmup:  return "W — Riscaldamento"
        case .dropset: return "D — Dropset"
        case .failure: return "F — Cedimento"
        }
    }
}
 
// MARK: - DeltaBadge
 
struct DeltaBadge: View {
    let percent: Double
    var body: some View {
        let isUp = percent >= 0
        Text(String(format: "%+.1f%%", percent))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(isUp ? Color.green.opacity(0.18) : Color.red.opacity(0.18))
            .foregroundStyle(isUp ? .green : .red)
            .clipShape(Capsule())
    }
}
 
// MARK: - RestBar
 
struct RestBar: View {
    let remaining: Int
    let total: Int
    let onSkip: () -> Void
 
    var progress: Double {
        total > 0 ? Double(remaining) / Double(total) : 0
    }
 
    var body: some View {
        HStack(spacing: 8) {
            Text("riposo")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(String(format: "%d:%02d", remaining / 60, remaining % 60))
                .font(.caption.weight(.bold))
                .foregroundStyle(.blue)
                .frame(width: 36)
                .monospacedDigit()
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(.tertiarySystemFill))
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.blue)
                        .frame(width: geo.size.width * progress)
                }
            }
            .frame(height: 4)
            Button("salta", action: onSkip)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.blue)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.blue.opacity(0.06))
    }
}
 
// MARK: - RestPickerSheet
 
struct RestPickerSheet: View {
    @Binding var seconds: Int
    @Environment(\.dismiss) private var dismiss
 
    let options = [30, 45, 60, 90, 120, 150, 180, 240, 300]
 
    var body: some View {
        NavigationStack {
            List(options, id: \.self) { s in
                HStack {
                    Text(formatSec(s))
                    Spacer()
                    if seconds == s {
                        Image(systemName: "checkmark").foregroundStyle(.blue)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture { seconds = s; dismiss() }
            }
            .navigationTitle("Riposo automatico")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
 
    private func formatSec(_ s: Int) -> String {
        s >= 60 ? "\(s / 60) min \(s % 60 > 0 ? "\(s % 60) sec" : "")" : "\(s) sec"
    }
}
 
