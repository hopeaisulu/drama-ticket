import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../../context/DataProvider';
import { supabase } from '../../utils/supabaseClient';
import Button from '../../components/Button';
import { notifyError, notifySuccess } from '../../utils/notify';
import '../../styles/Admin.css';

const EditEventPage = () => {
    const normalizeField = (value) => (value ?? '').toString().trim().replace(/\r\n/g, '\n');
    const toEditableEventFields = (source) => ({
        title: source?.title || '',
        location: source?.location || '',
        description: source?.description || '',
        director: source?.director || '',
        duration: source?.duration || '',
        image: source?.image || '',
        cast: source?.cast || [],
        tiers: source?.tiers || []
    });

    const { id } = useParams();
    const { events, updateEvent, loading } = useData();
    const [isUploading, setIsUploading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        location: '',
        description: '',
        director: '',
        duration: '',
        image: '',
        cast: [],
        tiers: []
    });

    const event = id ? events.find(e => e.id === parseInt(id)) : events[0];

    const [isSaving, setIsSaving] = useState(false);
    const [initialFormData, setInitialFormData] = useState(null);

    useEffect(() => {
        if (event) {
            const nextFields = toEditableEventFields(event);
            setFormData(nextFields);
            setInitialFormData(nextFields);
        }
    }, [event?.id]);

    const formHasChanges = React.useMemo(() => {
        if (!event || !initialFormData) return false;

        return (
            normalizeField(formData.title) !== normalizeField(initialFormData.title) ||
            normalizeField(formData.location) !== normalizeField(initialFormData.location) ||
            normalizeField(formData.description) !== normalizeField(initialFormData.description) ||
            normalizeField(formData.director) !== normalizeField(initialFormData.director) ||
            normalizeField(formData.duration) !== normalizeField(initialFormData.duration) ||
            normalizeField(formData.image) !== normalizeField(initialFormData.image)
        );
    }, [formData, event, initialFormData]);

    if (loading) return <div className="loading-spinner">Loading event details...</div>;

    if (!event) return (
        <div className="admin-page">
            <div className="admin-card text-center py-12">
                <h2 className="mb-4">Play Not Found</h2>
                <p className="text-muted mb-6">We couldn't find the play you're looking for. It might have been deleted.</p>
                <Button onClick={() => window.location.href = '/admin/dashboard'}>Back to Dashboard</Button>
            </div>
        </div>
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('posters')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('posters')
                .getPublicUrl(filePath);

            // 3. Update local state
            setFormData(prev => ({ ...prev, image: publicUrl }));
            notifySuccess('Poster image uploaded.');

        } catch (error) {
            console.error('Error uploading image:', error);
            notifyError(error.message || 'Upload failed.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!formHasChanges || isSaving) return;

        try {
            setIsSaving(true);
            const success = await updateEvent({
                ...event,
                ...formData
            });

            if (success) {
                setInitialFormData({ ...formData });
                notifySuccess('Changes saved successfully.');
            } else {
                notifyError('Save failed. Please try again.');
            }
        } catch (error) {
            console.error('Save error:', error);
            notifyError('Something went wrong while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="admin-page edit-event-page">
            <h1 className="page-title">Manage Event Details</h1>

            <div className="admin-grid-layout">
                <div className="admin-card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="input-label">Title</label>
                            <input
                                className="input-field"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label className="input-label">Location</label>
                            <input
                                className="input-field"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="input-label">Director</label>
                                <input
                                    className="input-field"
                                    name="director"
                                    value={formData.director}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="input-label">Duration</label>
                                <input
                                    className="input-field"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="input-label">Description</label>
                            <textarea
                                className="input-field"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="6"
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div className="form-actions">
                            <Button
                                type="submit"
                                disabled={!formHasChanges || isSaving}
                                variant={isSaving ? 'outline' : 'primary'}
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </div>

                <div className="admin-card text-center poster-panel">
                    <h3 className="mb-4">Event Poster</h3>
                    <div className="poster-preview-container mb-6">
                        {formData.image ? (
                            <img src={formData.image} alt="Poster Preview" className="poster-preview-img" />
                        ) : (
                            <div className="poster-placeholder">
                                No Image Selected
                            </div>
                        )}
                    </div>

                    <div className="poster-actions">
                        <div className="upload-btn-wrapper">
                            <label
                                htmlFor="poster-upload-input"
                                className={`btn ${isUploading ? 'btn-disabled is-disabled' : 'btn-outline'} btn-full poster-upload-trigger`}
                                aria-disabled={isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload New Image'}
                            </label>
                            <input
                                id="poster-upload-input"
                                className="poster-file-input"
                                type="file"
                                name="poster"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={isUploading}
                            />
                        </div>

                        <div className="poster-url-group">
                            <label className="input-label text-left">Or Paste Image URL</label>
                            <input
                                className="input-field"
                                name="image"
                                value={formData.image}
                                onChange={handleChange}
                                placeholder="https://example.com/poster.jpg"
                            />
                        </div>
                    </div>

                    <p className="text-tiny text-muted mt-4">
                        Recommended size: 800x1200px (Portrait)
                    </p>
                </div>
            </div>
        </div >
    );
};

export default EditEventPage;
