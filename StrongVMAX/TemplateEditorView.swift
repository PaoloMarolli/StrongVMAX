//
//  TemplateEditorView.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData

struct TemplateEditorView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    
    // nil = nuovo template, non-nil = modifica esistente
    let template: WorkoutTemplate?
    
    @State private var name: String = ""
    @State private var exercises: [TemplateExercise] = []
    @State private var showExercisePicker = false
    
    private var isEditing: Bool { template != nil }
    
    var body: some View {
        NavigationStack {
            List {
                // Nome template
                Section("Nome") {
                    TextField("es. Upper A, Push Day...", text: $name)
                }
                
                // Esercizi
                Section {
                    ForEach(exercises.sorted { $0.order < $1.order }) { ex in
                        TemplateExerciseRow(exercise: ex)
                    }
                    .onMove { from, to in
                        var sorted = exercises.sorted { $0.order < $1.order }
                        sorted.move(fromOffsets: from, toOffset: to)
                        for (i, e) in sorted.enumerated() { e.order = i }
                    }
                    .onDelete { indexSet in
                        let sorted = exercises.sorted { $0.order < $1.order }
                        for i in indexSet {
                            let ex = sorted[i]
                            exercises.removeAll { $0.id == ex.id }
                            context.delete(ex)
                        }
                    }
                    
                    Button {
                        showExercisePicker = true
                    } label: {
                        Label("Aggiungi esercizio", systemImage: "plus.circle.fill")
                            .foregroundStyle(.blue)
                    }
                } header: {
                    Text("Esercizi")
                } footer: {
                    if exercises.isEmpty {
                        Text("Aggiungi almeno un esercizio")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle(isEditing ? "Modifica template" : "Nuovo template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Salva") { save() }
                        .fontWeight(.semibold)
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { loadExisting() }
            .sheet(isPresented: $showExercisePicker) {
                ExercisePickerSheet { selected in
                    addExercise(selected)
                }
            }
        }
    }
    
    // MARK: - Load
    
    private func loadExisting() {
        guard let t = template else { return }
        name = t.name
        exercises = t.templateExercises
    }
    
    // MARK: - Add Exercise
    
    private func addExercise(_ exercise: Exercise) {
        let te = TemplateExercise(
            exerciseID: exercise.id,
            exerciseName: exercise.name,
            defaultSets: 3,
            defaultReps: 8,
            defaultWeight: 0,
            defaultRestSeconds: 90,
            order: exercises.count
        )
        context.insert(te)
        exercises.append(te)
        if let t = template {
            t.templateExercises.append(te)
        }
    }
    
    // MARK: - Save
    
    private func save() {
        if let t = template {
            t.name = name
            t.templateExercises = exercises
        } else {
            let fetchDescriptor = FetchDescriptor<WorkoutTemplate>()
            let count = (try? context.fetch(fetchDescriptor))?.count ?? 0
            let newTemplate = WorkoutTemplate(
                name: name,
                order: count,
                isCustom: true
            )
            context.insert(newTemplate)
            for ex in exercises {
                newTemplate.templateExercises.append(ex)
            }
        }
        try? context.save()
        dismiss()
    }
    
    // MARK: - TemplateExerciseRow
    
    struct TemplateExerciseRow: View {
        @Bindable var exercise: TemplateExercise
        @State private var showConfig = false
        
        var body: some View {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(exercise.exerciseName)
                            .font(.subheadline.weight(.medium))
                        Text("\(exercise.defaultSets) × \(exercise.defaultReps) reps · \(exercise.defaultRestSeconds)s riposo")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        showConfig.toggle()
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .foregroundStyle(.blue)
                            .font(.subheadline)
                    }
                }
                
                if showConfig {
                    Divider().padding(.vertical, 8)
                    
                    VStack(spacing: 12) {
                        HStack {
                            Text("Serie")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(width: 80, alignment: .leading)
                            Stepper("\(exercise.defaultSets)", value: $exercise.defaultSets, in: 1...20)
                                .font(.subheadline)
                        }
                        
                        HStack {
                            Text("Reps")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(width: 80, alignment: .leading)
                            Stepper("\(exercise.defaultReps)", value: $exercise.defaultReps, in: 1...50)
                                .font(.subheadline)
                        }
                        
                        HStack {
                            Text("Peso default")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(width: 80, alignment: .leading)
                            TextField("kg", value: $exercise.defaultWeight, format: .number)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 70)
                            Text("kg")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        HStack {
                            Text("Riposo")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(width: 80, alignment: .leading)
                            Picker("", selection: $exercise.defaultRestSeconds) {
                                ForEach([30, 45, 60, 90, 120, 150, 180, 240, 300], id: \.self) { s in
                                    Text(formatSec(s)).tag(s)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                    }
                    .padding(.bottom, 4)
                }
            }
            .padding(.vertical, 6)
            .animation(.easeInOut(duration: 0.2), value: showConfig)
        }
        
        private func formatSec(_ s: Int) -> String {
            s >= 60 ? "\(s / 60)m\(s % 60 > 0 ? " \(s % 60)s" : "")" : "\(s)s"
        }
    }
    
    // MARK: - ExercisePickerSheet
    
    struct ExercisePickerSheet: View {
        @Environment(\.modelContext) private var context
        @Query(sort: \Exercise.name) private var exercises: [Exercise]
        @Environment(\.dismiss) private var dismiss
        
        let onSelect: (Exercise) -> Void
        
        @State private var searchText = ""
        @State private var showAddExercise = false
        
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
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(ex.name)
                                                .foregroundStyle(.primary)
                                            Text(ex.equipment)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if ex.isCustom {
                                            Image(systemName: "person.fill")
                                                .font(.caption2)
                                                .foregroundStyle(.blue)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .searchable(text: $searchText, prompt: "Cerca esercizio")
                .navigationTitle("Scegli esercizio")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annulla") { dismiss() }
                    }
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            showAddExercise = true
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
                .sheet(isPresented: $showAddExercise) {
                    AddExerciseSheet()
                        .presentationDetents([.medium])
                }
            }
        }
    }
}
