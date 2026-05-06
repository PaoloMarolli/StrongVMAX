//
//  HistoryView.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 06/05/26.
//
import SwiftUI
import SwiftData

struct HistoryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \WorkoutSession.date, order: .reverse) private var sessions: [WorkoutSession]

    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty {
                    emptyState
                } else {
                    sessionList
                }
            }
            .navigationTitle("Storico")
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Nessuna sessione")
                .font(.title3.weight(.semibold))
            Text("Le tue sessioni completate appariranno qui")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }

    // MARK: - Session List

    private var sessionList: some View {
        List {
            ForEach(groupedSessions.keys.sorted(by: >), id: \.self) { week in
                Section(header: Text(weekLabel(week))) {
                    ForEach(groupedSessions[week]!, id: \.id) { session in
                        NavigationLink {
                            SessionDetailView(session: session)
                        } label: {
                            SessionRowCard(session: session)
                        }
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Grouping per settimana

    private var groupedSessions: [Date: [WorkoutSession]] {
        Dictionary(grouping: sessions) { session in
            Calendar.current.startOfWeek(for: session.date)
        }
    }

    private func weekLabel(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInThisWeek(date) { return "Questa settimana" }
        if calendar.isDateInLastWeek(date) { return "Settimana scorsa" }
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        formatter.locale = Locale(identifier: "it_IT")
        let end = calendar.date(byAdding: .day, value: 6, to: date)!
        return "\(formatter.string(from: date)) – \(formatter.string(from: end))"
    }
}

// MARK: - SessionRowCard

struct SessionRowCard: View {
    let session: WorkoutSession

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(session.templateName)
                    .font(.headline)
                Spacer()
                Text(session.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 16) {
                Label(session.formattedDuration, systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Label("\(Int(session.totalVolume)) kg", systemImage: "scalemass")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Label("\(session.exercises.count) esercizi", systemImage: "dumbbell")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - SessionDetailView

struct SessionDetailView: View {
    let session: WorkoutSession

    var body: some View {
        List {
            // Riepilogo
            Section {
                HStack(spacing: 0) {
                    StatCell(value: session.formattedDuration, label: "durata", color: .orange)
                    Divider()
                    StatCell(value: "\(Int(session.totalVolume)) kg", label: "volume", color: .green)
                    Divider()
                    StatCell(value: "\(session.exercises.count)", label: "esercizi", color: .blue)
                }
                .frame(height: 70)
                .listRowInsets(EdgeInsets())
            }

            // Esercizi
            ForEach(session.exercises.sorted { $0.order < $1.order }) { log in
                Section(log.exerciseName) {
                    // Header colonne
                    HStack {
                        Text("#").frame(width: 24, alignment: .leading)
                            .font(.caption).foregroundStyle(.secondary)
                        Text("Tipo").frame(width: 44)
                            .font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text("kg").frame(width: 50, alignment: .center)
                            .font(.caption).foregroundStyle(.secondary)
                        Text("reps").frame(width: 44, alignment: .center)
                            .font(.caption).foregroundStyle(.secondary)
                        Text("1RM").frame(width: 54, alignment: .trailing)
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .listRowBackground(Color.clear)

                    ForEach(Array(log.sortedSets.enumerated()), id: \.element.id) { i, set in
                        HStack {
                            Text("\(i + 1)").frame(width: 24, alignment: .leading)
                                .font(.subheadline).foregroundStyle(.secondary)
                            setTypeBadge(set.type).frame(width: 44)
                            Spacer()
                            Text(set.weight > 0 ? "\(Int(set.weight))" : "—")
                                .frame(width: 50, alignment: .center)
                                .font(.subheadline)
                            Text(set.reps > 0 ? "\(set.reps)" : "—")
                                .frame(width: 44, alignment: .center)
                                .font(.subheadline)
                            Text(set.theoreticalOneRM > 0 ? String(format: "%.1f", set.theoreticalOneRM) : "—")
                                .frame(width: 54, alignment: .trailing)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.orange)
                        }
                        .opacity(set.isCompleted ? 1 : 0.4)
                    }

                    // Topset
                    if let top = log.topSet {
                        HStack {
                            Image(systemName: "star.fill")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                            Text("Topset: \(Int(top.weight)) kg × \(top.reps) reps — 1RM \(String(format: "%.1f", top.theoreticalOneRM)) kg")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .listRowBackground(Color.orange.opacity(0.06))
                    }
                }
            }
        }
        .navigationTitle(session.templateName)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func setTypeBadge(_ type: SetType) -> some View {
        if type != .normal {
            Text(type.label)
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(badgeColor(type).opacity(0.18))
                .foregroundStyle(badgeColor(type))
                .clipShape(Capsule())
        } else {
            Color.clear
        }
    }

    private func badgeColor(_ type: SetType) -> Color {
        switch type {
        case .warmup:  return .orange
        case .dropset: return .purple
        case .failure: return .red
        default:       return .clear
        }
    }
}

// MARK: - StatCell

struct StatCell: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value).font(.title3.weight(.bold)).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Calendar extensions

extension Calendar {
    func startOfWeek(for date: Date) -> Date {
        let components = dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return self.date(from: components) ?? date
    }

    func isDateInThisWeek(_ date: Date) -> Bool {
        isDate(date, equalTo: Date(), toGranularity: .weekOfYear)
    }

    func isDateInLastWeek(_ date: Date) -> Bool {
        guard let lastWeek = self.date(byAdding: .weekOfYear, value: -1, to: Date()) else { return false }
        return isDate(date, equalTo: lastWeek, toGranularity: .weekOfYear)
    }
}
