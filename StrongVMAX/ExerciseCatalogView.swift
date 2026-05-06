//
//  ExerciseCatalogView.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData

struct ExerciseCatalogView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Exercise.name) private var exercises: [Exercise]

    @State private var searchText = ""
    @State private var showAddSheet = false

    private var filtered: [Exercise] {
        searchText.isEmpty ? exercises : exercises.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.muscleGroup.localizedCaseInsensitiveContains(searchText)
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
                            ExerciseRow(exercise: ex)
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Cerca esercizio o gruppo muscolare")
            .navigationTitle("Esercizi")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddSheet) {
                AddExerciseSheet()
                    .presentationDetents([.medium])
            }
        }
    }
}

// MARK: - ExerciseRow

struct ExerciseRow: View {
    @Environment(\.modelContext) private var context
    @Bindable var exercise: Exercise

    @State private var isEditing = false

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name)
                    .font(.subheadline)
                Text(exercise.equipment)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if exercise.isCustom {
                Image(systemName: "person.fill")
                    .font(.caption)
                    .foregroundStyle(.blue)
            }
        }
        .swipeActions(edge: .trailing) {
            if exercise.isCustom {
                Button(role: .destructive) {
                    context.delete(exercise)
                } label: {
                    Label("Elimina", systemImage: "trash")
                }
                Button {
                    isEditing = true
                } label: {
                    Label("Modifica", systemImage: "pencil")
                }
                .tint(.blue)
            }
        }
        .sheet(isPresented: $isEditing) {
            EditExerciseSheet(exercise: exercise)
                .presentationDetents([.medium])
        }
    }
}

// MARK: - AddExerciseSheet

struct AddExerciseSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var muscleGroup = ""
    @State private var equipment = ""

    let muscles = ["Petto", "Spalle", "Schiena", "Bicipiti", "Tricipiti", "Gambe", "Core", "Glutei", "Altro"]
    let equipments = ["Bilanciere", "Manubri", "Cavi", "Macchina", "Corpo libero", "Altro"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Nome") {
                    TextField("es. Curl martello", text: $name)
                }
                Section("Gruppo muscolare") {
                    Picker("Gruppo", selection: $muscleGroup) {
                        ForEach(muscles, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.menu)
                }
                Section("Attrezzatura") {
                    Picker("Attrezzatura", selection: $equipment) {
                        ForEach(equipments, id: \.self) { Text($0) }
                    }
                    .pickerStyle(.menu)
                }
            }
            .navigationTitle("Nuovo esercizio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Salva") {
                        let ex = Exercise(name: name, muscleGroup: muscleGroup,
                                          equipment: equipment, isCustom: true)
                        context.insert(ex)
                        try? context.save()
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - EditExerciseSheet

struct EditExerciseSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Bindable var exercise: Exercise

    var body: some View {
        NavigationStack {
            Form {
                Section("Nome") {
                    TextField("Nome", text: $exercise.name)
                }
                Section("Gruppo muscolare") {
                    TextField("Gruppo", text: $exercise.muscleGroup)
                }
                Section("Attrezzatura") {
                    TextField("Attrezzatura", text: $exercise.equipment)
                }
            }
            .navigationTitle("Modifica esercizio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Fatto") {
                        try? context.save()
                        dismiss()
                    }
                }
            }
        }
    }
}
