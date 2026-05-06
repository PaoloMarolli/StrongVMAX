//
//  ExercisePickerForWorkout.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 06/05/26.
//
import SwiftUI
import SwiftData

struct ExercisePickerForWorkout: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Exercise.name) private var exercises: [Exercise]
    @Environment(\.dismiss) private var dismiss

    let onSelect: (Exercise) -> Void

    @State private var searchText = ""

    private var filtered: [Exercise] {
        searchText.isEmpty ? exercises : exercises.filter {
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var grouped: [String: [Exercise]] {
        Dictionary(grouping: filtered, by: { $0.muscleGroup })
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(grouped.keys.sorted(), id: \.self) { group in
                    Section(group) {
                        ForEach(grouped[group]!) { ex in
                            Button {
                                onSelect(ex)
                                dismiss()
                            } label: {
                                HStack {
                                    Text(ex.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    Text(ex.equipment)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Cerca esercizio")
            .navigationTitle("Aggiungi esercizio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
            }
        }
    }
}

