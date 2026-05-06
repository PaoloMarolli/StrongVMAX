//
//  WorkoutListView.swift
//  StrongVMAX
//
//  Created by Paolo Marolli on 05/05/26.
//
import SwiftUI
import SwiftData
 
struct WorkoutListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \WorkoutTemplate.order) private var templates: [WorkoutTemplate]
 
    @State private var showAddTemplate = false
    @State private var activeTemplate: WorkoutTemplate? = nil
    @State private var editingTemplate: WorkoutTemplate? = nil
    @State private var showFreeWorkout = false
 
    var body: some View {
        NavigationStack {
            Group {
                if templates.isEmpty {
                    emptyState
                } else {
                    templateList
                }
            }
            .navigationTitle("Template")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddTemplate = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddTemplate) {
                TemplateEditorView(template: nil)
            }
            .sheet(item: $editingTemplate, onDismiss: {
                editingTemplate = nil
            }) { template in
                TemplateEditorView(template: template)
            }
            .fullScreenCover(item: $activeTemplate) { template in
                ActiveWorkoutView(template: template)
            }
        }
    }
 
    // MARK: - Empty State
 
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet.clipboard")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("Nessun template")
                .font(.title3.weight(.semibold))
            Text("Crea il tuo primo template di allenamento")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                showAddTemplate = true
            } label: {
                Label("Crea template", systemImage: "plus.circle.fill")
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(32)
    }
 
    // MARK: - Template List
 
    private var templateList: some View {
        List {
            ForEach(templates) { template in
                TemplateCard(template: template) {
                    activeTemplate = template
                } onEdit: {
                    editingTemplate = template
                }
            }
            .onMove { from, to in
                moveTemplates(from: from, to: to)
            }
            .onDelete { indexSet in
                deleteTemplates(at: indexSet)
            }
            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
        }
        .listStyle(.plain)
        // Rimosso .environment(\.editMode, .constant(.active)) — causava drag handle sempre visibili
        // Il riordino avviene tramite swipe che espone il tasto elimina, edit mode si attiva con il toolbar button
        .toolbar {
            EditButton()
        }
    }
 
    // MARK: - Actions
 
    private func moveTemplates(from: IndexSet, to: Int) {
        var reordered = Array(templates)
        reordered.move(fromOffsets: from, toOffset: to)
        for (i, t) in reordered.enumerated() { t.order = i }
        try? context.save()
    }
 
    private func deleteTemplates(at indexSet: IndexSet) {
        for i in indexSet { context.delete(templates[i]) }
        try? context.save()
    }
}
 
// MARK: - TemplateCard
 
struct TemplateCard: View {
    let template: WorkoutTemplate
    let onStart: () -> Void
    let onEdit: () -> Void
    
    private var exerciseNames: String {
        template.templateExercises
            .sorted { $0.order < $1.order }
            .prefix(3)
            .map { $0.exerciseName }
            .joined(separator: " · ")
    }
    
    private var exerciseCount: Int {
        template.templateExercises.count
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(template.name)
                        .font(.headline)
                    if exerciseCount > 0 {
                        Text(exerciseNames + (exerciseCount > 3 ? " +\(exerciseCount - 3)" : ""))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    } else {
                        Text("Nessun esercizio")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer()
                if template.isCustom {
                    Image(systemName: "person.fill")
                        .font(.caption)
                        .foregroundStyle(.blue)
                        .padding(.top, 2)
                }
            }
            
            HStack(spacing: 8) {
                Label("\(exerciseCount) esercizi", systemImage: "dumbbell")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                Button(action: onEdit) {
                    Label("Modifica", systemImage: "pencil")
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(Capsule())
                }
                .foregroundStyle(.primary)
                .buttonStyle(.borderless)  // ← aggiunto
                
                Button(action: onStart) {
                    Label("Inizia", systemImage: "play.fill")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(Color.blue)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(.borderless)  // ← aggiunto
            }
            .padding(14)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }
}
