//
//  ExerciseDetailSheet.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData
import Charts

struct ExerciseDetailSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    let exerciseID: UUID
    let exerciseName: String

    @State private var logs: [(log: ExerciseLog, date: Date)] = []

    private var allTimeMaxOneRM: Double {
        logs.compactMap { $0.log.topSet?.theoreticalOneRM }.max() ?? 0
    }

    private struct ChartPoint: Identifiable {
        let id = UUID()
        let date: Date
        let oneRM: Double
    }

    private var chartData: [ChartPoint] {
        logs
            .filter { $0.log.sessionOneRM > 0 }
            .map { ChartPoint(date: $0.date, oneRM: $0.log.sessionOneRM) }
            .sorted { $0.date < $1.date }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Stat cards
                    HStack(spacing: 16) {
                        StatCard2(
                            label: "1RM teorico best",
                            value: String(format: "%.1f kg", allTimeMaxOneRM),
                            color: .orange
                        )
                        StatCard2(
                            label: "sessioni totali",
                            value: "\(logs.count)",
                            color: .blue
                        )
                    }

                    // Grafico
                    if !chartData.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("1RM teorico nel tempo")
                                .font(.subheadline.weight(.semibold))

                            Chart(chartData) { point in
                                LineMark(
                                    x: .value("Data", point.date),
                                    y: .value("1RM", point.oneRM)
                                )
                                .foregroundStyle(.orange)
                                .interpolationMethod(.catmullRom)

                                PointMark(
                                    x: .value("Data", point.date),
                                    y: .value("1RM", point.oneRM)
                                )
                                .foregroundStyle(.orange)
                                .symbolSize(40)
                            }
                            .chartYAxis {
                                AxisMarks(position: .leading)
                            }
                            .chartXAxis {
                                AxisMarks(values: .stride(by: .weekOfYear)) { _ in
                                    AxisGridLine()
                                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                                }
                            }
                            .frame(height: 200)
                        }
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    // Storico sessioni
                    if !logs.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Storico sessioni")
                                .font(.subheadline.weight(.semibold))

                            ForEach(logs.sorted { $0.date > $1.date }, id: \.log.id) { item in
                                SessionRow(log: item.log, date: item.date)
                            }
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle(exerciseName)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Chiudi") { dismiss() }
                }
            }
            .onAppear { loadLogs() }
        }
    }

    private func loadLogs() {
        // Recupera tutte le sessioni completate e cerca i log per questo esercizio
        let descriptor = FetchDescriptor<WorkoutSession>(
            sortBy: [SortDescriptor(\.date, order: .reverse)]
        )
        guard let sessions = try? context.fetch(descriptor) else { return }
        var result: [(log: ExerciseLog, date: Date)] = []
        for session in sessions {
            if let log = session.exercises.first(where: { $0.exerciseID == exerciseID }) {
                result.append((log: log, date: session.date))
            }
        }
        logs = result
    }
}

// MARK: - SessionRow

struct SessionRow: View {
    let log: ExerciseLog
    let date: Date

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(date.formatted(date: .abbreviated, time: .omitted))
                    .font(.subheadline.weight(.medium))
                if let top = log.topSet {
                    Text("Topset: \(Int(top.weight)) kg × \(top.reps) reps")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(String(format: "%.1f kg", log.sessionOneRM))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.orange)
                Text("1RM teorico")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - StatCard2

struct StatCard2: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
