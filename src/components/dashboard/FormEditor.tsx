
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { Button } from '../ui/button';
import { Pencil, Trash2, Plus, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';

interface OptionSet {
  options: string[];
  condition?: {
    field: string;
    value: string;
  };
}

interface Field {
  id: string;
  label: string;
  type: string;
  name: string;
  order: number;
  options?: string[];
  optionSets?: OptionSet[];
  conditional?: {
    field: string;
    value: string;
  };
}

const FormEditor = () => {
  const [originalFormFields, setOriginalFormFields] = useState<Field[]>([]);
  const [editedFormFields, setEditedFormFields] = useState<Field[]>([]);
  const [newField, setNewField] = useState<{
    label: string,
    type: string,
    options: string[],
    conditional?: {
      field: string;
      value: string;
    }
  }>({ label: '', type: 'text', options: [] });
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  const formFieldsCollection = collection(db, 'form-structure');

  const fetchFormFields = async () => {
    setLoading(true);
    const q = query(formFieldsCollection, orderBy('order'));
    const querySnapshot = await getDocs(q);
    const fields = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Field));
    setOriginalFormFields(fields);
    setEditedFormFields(fields);
    setLoading(false);
    setHasChanges(false);
  };

  useEffect(() => {
    fetchFormFields();
  }, []);

  useEffect(() => {
    const changed = JSON.stringify(originalFormFields.map(f => ({...f, id: ''}))) !== JSON.stringify(editedFormFields.map(f => ({...f, id: ''})));
    setHasChanges(changed);
  }, [editedFormFields, originalFormFields]);

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === editedFormFields.length - 1)
    ) {
      return;
    }

    const items = Array.from(editedFormFields);
    const [reorderedItem] = items.splice(index, 1);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    items.splice(newIndex, 0, reorderedItem);

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setEditedFormFields(updatedItems);
  };
  
  const handleAddField = () => {
    if (!newField.label) {
      alert('Please enter a label for the new field.');
      return;
    }
    const fieldToAdd: any = {
      label: newField.label,
      type: newField.type,
      name: newField.label.toLowerCase().replace(/\s/g, '-'),
      id: `new-${Date.now()}`,
      order: editedFormFields.length,
    };
    if (newField.type === 'select') {
      fieldToAdd.optionSets = [{ options: newField.options.filter(opt => opt.trim() !== '') }];
    }
    if (newField.conditional && newField.conditional.field && newField.conditional.value) {
        fieldToAdd.conditional = newField.conditional;
    }
    setEditedFormFields([...editedFormFields, fieldToAdd]);
    setNewField({ label: '', type: 'text', options: [] });
    setShowAddField(false);
  };

  const handleDeleteField = (id: string) => {
    const updatedFields = editedFormFields.filter(field => field.id !== id)
      .map((field, index) => ({ ...field, order: index }));
    setEditedFormFields(updatedFields);
    setEditingField(null);
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    const batch = writeBatch(db);

    editedFormFields.forEach((field, index) => {
      const { id, ...fieldData } = field;
      const data: any = { ...fieldData, order: index };
      
      if(data.conditional && (!data.conditional.field || !data.conditional.value)) {
        delete data.conditional;
      }
      
      if (data.optionSets) {
          data.optionSets = data.optionSets.filter((set: OptionSet) => {
              if (set.condition && (!set.condition.field || !set.condition.value)) {
                  return false;
              }
              return true;
          });

          data.optionSets = data.optionSets.filter((set: OptionSet) => {
              return set.options.length > 0 || !set.condition;
          });
          
          if(data.optionSets.length > 0) {
            delete data.options;
          }
      }

      if (id.startsWith('new-')) {
        const { id: newId, ...rest } = data;
        batch.set(doc(formFieldsCollection), rest);
      } else {
        batch.update(doc(db, 'form-structure', id), data);
      }
    });

    originalFormFields.forEach(field => {
      if (!editedFormFields.some(f => f.id === field.id)) {
        batch.delete(doc(db, 'form-structure', field.id));
      }
    });

    await batch.commit();
    fetchFormFields();
  };

  const handleDiscardChanges = () => {
    setEditedFormFields(originalFormFields);
  };

  const handleEditField = (field: Field) => {
    setShowAddField(false);
    const fieldToEdit = { ...field };
    if (fieldToEdit.type === 'select' && !fieldToEdit.optionSets) {
        fieldToEdit.optionSets = [{ options: fieldToEdit.options || [] }];
    }
    setEditingField(fieldToEdit);
  };

  const handleUpdateField = () => {
    if (!editingField) return;
    const updatedFields = editedFormFields.map(f =>
      f.id === editingField.id ? editingField : f
    );
    setEditedFormFields(updatedFields);
    setEditingField(null);
  };
  
  const handleOptionChange = (setIndex: number, optIndex: number, value: string) => {
    if (!editingField || !editingField.optionSets) return;
    const newOptionSets = [...editingField.optionSets];
    newOptionSets[setIndex].options[optIndex] = value;
    setEditingField({ ...editingField, optionSets: newOptionSets });
  };

  const addOption = (setIndex: number) => {
    if (!editingField || !editingField.optionSets) return;
    const newOptionSets = [...editingField.optionSets];
    newOptionSets[setIndex].options.push('');
    setEditingField({ ...editingField, optionSets: newOptionSets });
  };

  const removeOption = (setIndex: number, optIndex: number) => {
    if (!editingField || !editingField.optionSets) return;
    const newOptionSets = [...editingField.optionSets];
    newOptionSets[setIndex].options.splice(optIndex, 1);
    setEditingField({ ...editingField, optionSets: newOptionSets });
  };
  
  const addOptionSet = () => {
      if (!editingField) return;
      const newOptionSets = [...(editingField.optionSets || []), { options: [], condition: { field: '', value: ''} }];
      setEditingField({ ...editingField, optionSets: newOptionSets });
  }

  const removeOptionSet = (setIndex: number) => {
      if (!editingField) return;
      const newOptionSets = editingField.optionSets?.filter((_, i) => i !== setIndex);
      setEditingField({ ...editingField, optionSets: newOptionSets });
  }

  const handleConditionFieldChange = (setIndex: number, fieldId: string) => {
      if (!editingField || !editingField.optionSets) return;
      const newOptionSets = [...editingField.optionSets];
      newOptionSets[setIndex].condition = { field: fieldId, value: '' };
      setEditingField({ ...editingField, optionSets: newOptionSets });
  }

  const handleConditionValueChange = (setIndex: number, value: string) => {
      if (!editingField || !editingField.optionSets) return;
      const newOptionSets = [...editingField.optionSets];
      newOptionSets[setIndex].condition!.value = value;
      setEditingField({ ...editingField, optionSets: newOptionSets });
  }

  const handleNewOptionChange = (index: number, value: string) => {
    const updatedOptions = [...newField.options];
    updatedOptions[index] = value;
    setNewField(prev => ({ ...prev, options: updatedOptions }));
  };

  const addOptionForNewField = () => {
      setNewField(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeOptionForNewField = (index: number) => {
      const updatedOptions = newField.options.filter((_, i) => i !== index);
      setNewField(prev => ({ ...prev, options: updatedOptions }));
  };

  if (loading) {
    return <div>Loading...</div>
  }

  const dropdownFields = editedFormFields.filter(field => field.type === 'select');

  const getConditionalFieldOptions = (fieldId: string): string[] => {
      const field = editedFormFields.find(f => f.id === fieldId);
      if (!field || field.type !== 'select') return [];

      let allOptions: string[] = [];

      if (field.options) {
          allOptions.push(...field.options);
      }
      else if (field.optionSets) {
          field.optionSets.forEach(set => {
              allOptions.push(...set.options);
          });
      }

      return [...new Set(allOptions)];
  }

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold">Report Issue Form Editor</h3>
        <Button onClick={() => window.location.href = '/'} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="space-y-4">
        {editedFormFields.map((field, index) => (
          <div key={field.id} className="border p-4 rounded-lg bg-white">
            <div className="flex items-start">
              <div className="flex-grow">
                {editingField?.id === field.id ? (
                  // Editing view
                  <div className="w-full space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                        <input
                            type="text"
                            value={editingField.label}
                            onChange={e => setEditingField({ ...editingField, label: e.target.value, name: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                            className="w-full p-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                            value={editingField.type}
                            onChange={e => setEditingField({ ...editingField, type: e.target.value, optionSets: e.target.value === 'select' ? editingField.optionSets || [{options: []}] : undefined })}
                            className="w-full p-2 border rounded"
                        >
                            <option value="text">Text</option>
                            <option value="select">Dropdown</option>
                            <option value="textarea">Text Area</option>
                        </select>
                      </div>
                    </div>
      
                    {editingField.type === 'select' && (
                      <div className="space-y-4 pt-4">
                          <h5 className="font-semibold mb-2 text-gray-800">Conditional Options</h5>
                          {editingField.optionSets?.map((set, setIndex) => (
                              <div key={setIndex} className="p-3 border rounded-md bg-gray-50">
                                  {set.condition ? (
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3 text-sm">
                                          <span className="flex-shrink-0">Display if</span>
                                          <select
                                              value={set.condition.field}
                                              onChange={e => handleConditionFieldChange(setIndex, e.target.value)}
                                              className="p-2 border rounded text-xs w-full sm:w-auto"
                                          >
                                              <option value="">Select Field...</option>
                                              {dropdownFields.filter(f => f.id !== editingField.id).map(f => (
                                                  <option key={f.id} value={f.id}>{f.label}</option>
                                              ))}
                                          </select>
                                          <span className="flex-shrink-0">is</span>
                                          <select
                                              value={set.condition.value}
                                              onChange={e => handleConditionValueChange(setIndex, e.target.value)}
                                              className="p-2 border rounded text-xs w-full sm:w-auto"
                                              disabled={!set.condition.field}
                                          >
                                              <option value="">Select Value...</option>
                                              <option value="any">Any value</option>
                                              {set.condition.field && getConditionalFieldOptions(set.condition.field).map(opt => (
                                                  <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                          </select>
                                          <Button variant="ghost" size="icon" onClick={() => removeOptionSet(setIndex)} className="ml-auto">
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                          </Button>
                                      </div>
                                  ) : (
                                    <h6 className="font-semibold mb-2 text-gray-600">Default Options</h6>
                                  )}
                                  
                                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                      {set.options.map((option, optIndex) => (
                                          <div key={optIndex} className="flex items-center gap-2">
                                              <input
                                                  type="text"
                                                  placeholder="Option Label"
                                                  value={option}
                                                  onChange={(e) => handleOptionChange(setIndex, optIndex, e.target.value)}
                                                  className="w-full p-2 border rounded"
                                              />
                                              <Button variant="ghost" size="icon" onClick={() => removeOption(setIndex, optIndex)}>
                                                  <Trash2 className="h-4 w-4 text-red-500" />
                                              </Button>
                                          </div>
                                      ))}
                                  </div>
                                  <Button variant="outline" size="sm" className="mt-2" onClick={() => addOption(setIndex)}>
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Option
                                  </Button>
                              </div>
                          ))}
                          <Button variant="secondary" size="sm" onClick={addOptionSet}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Conditional Option Set
                          </Button>
                      </div>
                    )}
      
                    <div className="pt-4">
                        <h5 className="font-semibold mb-2 text-gray-800">Field Visibility</h5>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
                            <span className="flex-shrink-0">Show this field if</span>
                            <select
                                value={editingField.conditional?.field || ''}
                                onChange={e => setEditingField({ ...editingField, conditional: { ...(editingField.conditional || { value: '' }), field: e.target.value, value: '' } })}
                                className="p-2 border rounded w-full sm:w-auto"
                            >
                                <option value="">Always show</option>
                                {dropdownFields.filter(f => f.id !== editingField.id).map(f => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                ))}
                            </select>
                            {editingField.conditional?.field && (
                              <>
                                <span className="flex-shrink-0">is</span>
                                <select
                                    value={editingField.conditional.value}
                                    onChange={e => setEditingField({ ...editingField, conditional: { ...(editingField.conditional!), value: e.target.value } })}
                                    className="p-2 border rounded w-full sm:w-auto"
                                >
                                    <option value="">Select Value...</option>
                                    <option value="any">Any value</option>
                                    {getConditionalFieldOptions(editingField.conditional.field).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                              </>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 p-3 mt-4 bg-gray-50 rounded-b-lg">
                        <Button onClick={() => setEditingField(null)} variant="ghost">Cancel</Button>
                        <Button onClick={handleUpdateField}>Update Field</Button>
                        <Button onClick={() => handleDeleteField(editingField.id)} size="sm" variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                    </div>
                  </div>
                ) : (
                  // Display view
                  <div className="flex justify-between items-center w-full">
                    <div className="flex-grow">
                      <p className="font-semibold">{field.label}</p>
                      <p className="text-sm text-gray-500">Type: {field.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => moveField(index, 'up')} size="icon" variant="outline" disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => moveField(index, 'down')} size="icon" variant="outline" disabled={index === editedFormFields.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                        <div className="flex-grow" />
                        <Button onClick={() => handleEditField(field)} size="sm" variant="outline"><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                        <Button onClick={() => handleDeleteField(field.id)} size="sm" variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddField && (
          <div className="border p-4 rounded-lg mt-4 bg-gray-50">
            <h4 className="font-semibold mb-4 text-lg">Add New Field</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                  type="text"
                  placeholder="Field Label (e.g., Building)"
                  value={newField.label}
                  onChange={e => setNewField({ ...newField, label: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <select value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value, options: [] })} className="w-full px-4 py-3 border border-gray-300 rounded-lg">
                  <option value="text">Text</option>
                  <option value="select">Dropdown</option>
                  <option value="textarea">Text Area</option>
              </select>
            </div>
            {newField.type === 'select' && (
                <div className="pl-2 mt-4">
                    <h5 className="font-semibold mb-2 text-gray-800">Options</h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {newField.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Option Label"
                                value={option}
                                onChange={(e) => handleNewOptionChange(index, e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOptionForNewField(index)}
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={addOptionForNewField}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Option
                    </Button>
                </div>
            )}
  
            <div className="mt-4">
                <h5 className="font-semibold mb-2 text-gray-800">Field Visibility</h5>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
                    <span className="flex-shrink-0">Show this field if</span>
                    <select
                        value={newField.conditional?.field || ''}
                        onChange={e => setNewField({ ...newField, conditional: { ...(newField.conditional || { value: '' }), field: e.target.value, value: '' } })}
                        className="p-2 border rounded w-full sm:w-auto"
                    >
                        <option value="">Always show</option>
                        {dropdownFields.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                    </select>
                    {newField.conditional?.field && (
                        <>
                            <span className="flex-shrink-0">is</span>
                            <select
                                value={newField.conditional.value}
                                onChange={e => setNewField({ ...newField, conditional: { ...(newField.conditional!), value: e.target.value } })}
                                className="p-2 border rounded w-full sm:w-auto"
                            >
                                <option value="">Select Value...</option>
                                <option value="any">Any value</option>
                                {getConditionalFieldOptions(newField.conditional.field).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </>
                    )}
                </div>
            </div>
            
              <div className="flex justify-end gap-4 pt-6 mt-4">
                <Button onClick={() => setShowAddField(false)} variant="outline">Cancel</Button>
                <Button onClick={handleAddField} variant="default">Add Field</Button>
              </div>
          </div>
        )}

      {!showAddField && ( <Button onClick={() => { setEditingField(null); setShowAddField(true); }} className="mt-6"><Plus className="mr-2 h-4 w-4"/>Add New Field</Button>)}
            
      {hasChanges && (
        <div className="flex justify-end gap-4 pt-6 mt-6 border-t">
          <Button onClick={handleDiscardChanges} variant="destructive">Discard Changes</Button>
          <Button onClick={handleSaveChanges} variant="secondary">Save Changes</Button>
        </div>
      )}
    </div>
  );
};

export default FormEditor;
